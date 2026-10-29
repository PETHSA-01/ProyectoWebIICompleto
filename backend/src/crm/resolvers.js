// Resolvers del Modulo 4 — CRM: clientes y tickets de soporte.
//
// El perfil del cliente NO es una tabla nueva: se construye por agregacion
// sobre pedidos y detalle_pedido (sin N+1: cada dato sale de un GROUP BY).
import { query, queryOne } from '../db.js';
import { requerirPanel, requerirUsuario } from '../auth/context.js';
import { fechaHora } from '../util/fechas.js';

const CLIENTE_BASE = `
  SELECT u.id, u.nombre, u.email, u.avatar_url,
         COUNT(p.id) FILTER (WHERE p.status <> 'CANCELLED')::int AS total_pedidos,
         COALESCE(SUM(CASE WHEN p.status <> 'CANCELLED' THEN p.total ELSE 0 END), 0) AS total_gastado,
         MIN(p.fecha) FILTER (WHERE p.status <> 'CANCELLED') AS primera_compra,
         MAX(p.fecha) FILTER (WHERE p.status <> 'CANCELLED') AS ultima_compra,
         (SELECT COUNT(*) FROM tickets_soporte t
           WHERE t.usuario_id = u.id AND t.estado <> 'CERRADO')::int AS tickets_abiertos
    FROM usuarios u
    LEFT JOIN pedidos p ON p.usuario_id = u.id
`;

function conDerivados(fila) {
  const totalPedidos = Number(fila.total_pedidos || 0);
  const totalGastado = Number(fila.total_gastado || 0);
  return {
    ...fila,
    ticketPromedio: totalPedidos > 0 ? totalGastado / totalPedidos : 0,
  };
}

export const resolversCrm = {
  Query: {
    clientes: async (_, { busqueda }, context) => {
      requerirPanel(context);
      const texto = (busqueda || '').trim();
      const filas = await query(
        `${CLIENTE_BASE}
          WHERE u.rol = 'CLIENTE'
            AND ($1 = '' OR u.nombre ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
          GROUP BY u.id
          ORDER BY total_gastado DESC, u.nombre ASC`,
        [texto]
      );
      return filas.map(conDerivados);
    },

    perfilCliente: async (_, { usuarioId }, context) => {
      requerirPanel(context);
      const usuario = await queryOne('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
      if (!usuario) return null;

      const [base, categoria, productos] = await Promise.all([
        queryOne(`${CLIENTE_BASE} WHERE u.id = $1 GROUP BY u.id`, [usuarioId]),
        queryOne(
          `SELECT c.nombre, SUM(d.cantidad) AS unidades
             FROM detalle_pedido d
             JOIN pedidos p ON p.id = d.pedido_id
             JOIN productos pr ON pr.id = d.producto_id
             JOIN categorias c ON c.id = pr.categoria_id
            WHERE p.usuario_id = $1 AND p.status <> 'CANCELLED'
            GROUP BY c.nombre
            ORDER BY unidades DESC
            LIMIT 1`,
          [usuarioId]
        ),
        query(
          `SELECT pr.id AS producto_id, pr.nombre, SUM(d.cantidad)::int AS cantidad
             FROM detalle_pedido d
             JOIN pedidos p ON p.id = d.pedido_id
             JOIN productos pr ON pr.id = d.producto_id
            WHERE p.usuario_id = $1 AND p.status <> 'CANCELLED'
            GROUP BY pr.id, pr.nombre
            ORDER BY cantidad DESC
            LIMIT 5`,
          [usuarioId]
        ),
      ]);

      return {
        usuario,
        ...conDerivados(base || {}),
        categoriaFavorita: categoria ? categoria.nombre : null,
        productosMasComprados: productos,
      };
    },

    ticketsSoporte: (_, { usuarioId }, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM tickets_soporte
          WHERE ($1::int IS NULL OR usuario_id = $1)
          ORDER BY (estado = 'CERRADO') ASC, prioridad DESC, id DESC`,
        [usuarioId ?? null]
      );
    },
  },

  Mutation: {
    crearTicketSoporte: async (_, { datos }, context) => {
      const usuario = requerirUsuario(context);
      const asunto = (datos.asunto || '').trim();
      const descripcion = (datos.descripcion || '').trim();
      if (!asunto) throw new Error('El asunto del ticket es obligatorio.');
      if (!descripcion) throw new Error('La descripcion del ticket es obligatoria.');

      let usuarioId = usuario.id;
      if (datos.usuarioId && Number(datos.usuarioId) !== usuario.id) {
        // Abrir un ticket a nombre de otro es una accion del panel.
        requerirPanel(context);
        usuarioId = Number(datos.usuarioId);
        const existe = await queryOne('SELECT id FROM usuarios WHERE id = $1', [usuarioId]);
        if (!existe) throw new Error(`No existe el usuario ${usuarioId}.`);
      }

      let pedidoId = datos.pedidoId ? Number(datos.pedidoId) : null;
      if (pedidoId) {
        const pedido = await queryOne('SELECT usuario_id FROM pedidos WHERE id = $1', [pedidoId]);
        if (!pedido) throw new Error(`No existe el pedido ${pedidoId}.`);
        if (pedido.usuario_id !== usuarioId) {
          throw new Error('El pedido no pertenece al usuario del ticket.');
        }
      }

      return queryOne(
        `INSERT INTO tickets_soporte
           (usuario_id, pedido_id, asunto, descripcion, prioridad)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [usuarioId, pedidoId, asunto, descripcion, datos.prioridad || 'MEDIA']
      );
    },

    cambiarEstadoTicket: async (_, { id, estado }, context) => {
      requerirPanel(context);
      const ticket = await queryOne('SELECT * FROM tickets_soporte WHERE id = $1', [id]);
      if (!ticket) return null;
      return queryOne(
        `UPDATE tickets_soporte
            SET estado = $2,
                cerrado_en = CASE WHEN $2 = 'CERRADO' THEN now() ELSE NULL END
          WHERE id = $1
          RETURNING *`,
        [id, estado]
      );
    },
  },

  ClienteResumen: {
    avatarUrl: (c) => c.avatar_url,
    totalPedidos: (c) => Number(c.total_pedidos || 0),
    totalGastado: (c) => Number(c.total_gastado || 0),
    ticketPromedio: (c) => Number(c.ticketPromedio || 0),
    primeraCompra: (c) => fechaHora(c.primera_compra),
    ultimaCompra: (c) => fechaHora(c.ultima_compra),
    ticketsAbiertos: (c) => Number(c.tickets_abiertos || 0),
  },

  PerfilCliente: {
    totalPedidos: (p) => Number(p.total_pedidos || 0),
    totalGastado: (p) => Number(p.total_gastado || 0),
    ticketPromedio: (p) => Number(p.ticketPromedio || 0),
    primeraCompra: (p) => fechaHora(p.primera_compra),
    ultimaCompra: (p) => fechaHora(p.ultima_compra),
    ticketsAbiertos: (p) => Number(p.tickets_abiertos || 0),
    productosMasComprados: (p) => p.productosMasComprados || [],
  },

  ConteoProducto: {
    productoId: (c) => c.producto_id,
    cantidad: (c) => Number(c.cantidad || 0),
  },

  TicketSoporte: {
    usuario: (t) => queryOne('SELECT * FROM usuarios WHERE id = $1', [t.usuario_id]),
    pedido: (t) =>
      t.pedido_id ? queryOne('SELECT * FROM pedidos WHERE id = $1', [t.pedido_id]) : null,
    creadoEn: (t) => fechaHora(t.creado_en),
    cerradoEn: (t) => fechaHora(t.cerrado_en),
  },
};
