// Resolvers del Modulo 3 — Logistica y envios.
//
// El envio se genera con el adaptador unico (src/envios/paqueterias.js).
// Regla de negocio: solo se genera guia de un pedido CONFIRMADO (pagado) o
// ya SHIPPED (reimpresion); al generarla, el pedido pasa a SHIPPED y queda
// registrado en la bitacora. Marcar entregado cierra el ciclo.
import { query, queryOne, withTransaction } from '../db.js';
import { requerirPanel } from '../auth/context.js';
import { crearGuia as crearGuiaPaqueteria } from '../envios/paqueterias.js';
import { fechaDia, fechaHora } from '../util/fechas.js';

async function registrarHistorial(client, { pedidoId, anterior, nuevo, comentario, usuarioId }) {
  await client.queryOne(
    `INSERT INTO historial_estados_pedido
       (pedido_id, estado_anterior, estado_nuevo, comentario, usuario_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [pedidoId, anterior, nuevo, comentario ?? null, usuarioId ?? null]
  );
}

export const resolversLogistica = {
  Query: {
    envios: (_, { paqueteria }, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM envios
          WHERE ($1::text IS NULL OR paqueteria = $1)
          ORDER BY id DESC`,
        [paqueteria ?? null]
      );
    },

    historialPedido: (_, { pedidoId }, context) => {
      requerirPanel(context);
      return query(
        'SELECT * FROM historial_estados_pedido WHERE pedido_id = $1 ORDER BY id',
        [pedidoId]
      );
    },
  },

  Mutation: {
    crearGuia: async (_, { pedidoId, paqueteria = 'SIMULADA', paquete }, context) => {
      const usuario = requerirPanel(context);
      const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
      if (!pedido) throw new Error(`No existe el pedido ${pedidoId}.`);
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no puede enviarse.');
      }
      if (!['CONFIRMED', 'SHIPPED'].includes(pedido.status)) {
        throw new Error(
          'Solo se genera guia de un pedido confirmado (pagado). Confirma el cobro primero.'
        );
      }
      const yaTiene = await queryOne('SELECT id FROM envios WHERE pedido_id = $1', [pedidoId]);
      if (yaTiene) {
        throw new Error(`El pedido ${pedidoId} ya tiene guia (#${yaTiene.id}).`);
      }

      // La guia se genera fuera de la transaccion: si algun dia el adaptador
      // real hace una llamada HTTP, no se deja una transaccion abierta.
      const guia = await crearGuiaPaqueteria({
        pedido,
        paqueteria,
        paquete: paquete || {},
        direccion: {
          calle: pedido.direccion_envio,
          ciudad: pedido.ciudad,
          estado: pedido.estado_geo,
          codigoPostal: pedido.codigo_postal,
        },
      });

      return withTransaction(async (client) => {
        const envio = await client.queryOne(
          `INSERT INTO envios
             (pedido_id, paqueteria, numero_guia, url_rastreo, costo_envio,
              fecha_entrega_estimada, simulada)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            pedidoId,
            guia.paqueteria,
            guia.numeroGuia,
            guia.urlRastreo,
            guia.costoEnvio,
            guia.fechaEntregaEstimada,
            Boolean(guia.simulada),
          ]
        );

        if (pedido.status === 'CONFIRMED') {
          await client.queryOne(
            `UPDATE pedidos SET status = 'SHIPPED' WHERE id = $1`,
            [pedidoId]
          );
          await registrarHistorial(client, {
            pedidoId,
            anterior: pedido.status,
            nuevo: 'SHIPPED',
            comentario: `Guia ${guia.paqueteria} ${guia.numeroGuia}`,
            usuarioId: usuario.id,
          });
        }
        return envio;
      });
    },

    marcarEntregado: async (_, { pedidoId }, context) => {
      const usuario = requerirPanel(context);
      return withTransaction(async (client) => {
        const pedido = await client.queryOne(
          'SELECT * FROM pedidos WHERE id = $1 FOR UPDATE',
          [pedidoId]
        );
        if (!pedido) throw new Error(`No existe el pedido ${pedidoId}.`);
        if (pedido.status !== 'SHIPPED') {
          throw new Error('Solo se puede entregar un pedido que ya fue enviado.');
        }
        const actualizado = await client.queryOne(
          `UPDATE pedidos SET status = 'DELIVERED' WHERE id = $1 RETURNING *`,
          [pedidoId]
        );
        await client.queryOne(
          `UPDATE envios SET entregado_en = now() WHERE pedido_id = $1`,
          [pedidoId]
        );
        await registrarHistorial(client, {
          pedidoId,
          anterior: pedido.status,
          nuevo: 'DELIVERED',
          comentario: 'Entrega confirmada',
          usuarioId: usuario.id,
        });
        return actualizado;
      });
    },
  },

  Envio: {
    pedido: (e) => queryOne('SELECT * FROM pedidos WHERE id = $1', [e.pedido_id]),
    numeroGuia: (e) => e.numero_guia,
    urlRastreo: (e) => e.url_rastreo,
    costoEnvio: (e) => Number(e.costo_envio || 0),
    fechaCreacion: (e) => fechaHora(e.fecha_creacion),
    fechaEntregaEstimada: (e) => fechaDia(e.fecha_entrega_estimada),
    entregadoEn: (e) => fechaHora(e.entregado_en),
    simulada: (e) => e.simulada !== false,
  },

  HistorialEstado: {
    fecha: (h) => fechaHora(h.fecha),
    estadoAnterior: (h) => h.estado_anterior,
    estadoNuevo: (h) => h.estado_nuevo,
    usuario: (h) =>
      h.usuario_id ? queryOne('SELECT * FROM usuarios WHERE id = $1', [h.usuario_id]) : null,
  },

  Pedido: {
    envio: (p) => queryOne('SELECT * FROM envios WHERE pedido_id = $1', [p.id]),
    historial: (p) =>
      query('SELECT * FROM historial_estados_pedido WHERE pedido_id = $1 ORDER BY id', [p.id]),
  },
};
