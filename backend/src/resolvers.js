import { query, queryOne, withTransaction } from './db.js';
import { requerirAdmin, requerirUsuario } from './auth/context.js';
import { firmarToken } from './auth/jwt.js';
import { verificarIdTokenGoogle, buscarOCrearUsuarioGoogle } from './auth/google.js';

// ---------------------------------------------------------------
// Notas de migracion (P2-6 -> Proyecto Final):
//
// - better-sqlite3 (sincrono, .prepare().all()/.get()/.run()) se
//   reemplaza por pg (asincrono, todo con await). Cada resolver que antes
//   era una funcion normal ahora es "async".
// - Los "?" de SQLite se vuelven "$1, $2, ..." (placeholders de Postgres).
// - lastInsertRowid no existe en pg: se usa "RETURNING *" en el INSERT
//   para obtener la fila recien creada en un solo viaje a la base.
// - db.transaction(fn) se reemplaza por withTransaction(async (client) => {...})
//   (ver src/db.js), que hace BEGIN/COMMIT/ROLLBACK con una conexion dedicada.
// ---------------------------------------------------------------

export const resolvers = {
  Query: {
    // NOTA sobre N+1: esta query trae todas las categorias con una sola
    // consulta; pero como Categoria.productos hace una consulta POR
    // categoria (ver resolver de campo abajo), listar N categorias
    // termina ejecutando 1 + N consultas. Para un catalogo pequeno esto
    // es aceptable; se documenta la solucion (batching con DataLoader o
    // un JOIN + agrupado en memoria) en el reporte de la practica P6.
    categorias: () => query('SELECT * FROM categorias ORDER BY id'),
    categoria: (_, { id }) =>
      queryOne('SELECT * FROM categorias WHERE id = $1', [id]),

    productos: (_, { limite = 20, desde = 0 }) =>
      query('SELECT * FROM productos ORDER BY id LIMIT $1 OFFSET $2', [limite, desde]),
    producto: (_, { id }) => queryOne('SELECT * FROM productos WHERE id = $1', [id]),

    // Un CLIENTE solo ve sus propios pedidos; un ADMIN los ve todos.
    // (Esta misma regla se repite a nivel de base de datos con RLS para
    // las llamadas que pasen directo por PostgREST; aqui se aplica para
    // las llamadas via GraphQL.)
    pedidos: (_, __, context) => {
      const usuario = requerirUsuario(context);
      if (usuario.rol === 'ADMIN') {
        return query('SELECT * FROM pedidos ORDER BY id DESC');
      }
      return query(
        'SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY id DESC',
        [usuario.id]
      );
    },

    yo: (_, __, context) => {
      if (!context.usuario) return null;
      return queryOne('SELECT * FROM usuarios WHERE id = $1', [context.usuario.id]);
    },
  },

  Mutation: {
    crearProducto: async (_, { datos }, context) => {
      requerirAdmin(context);
      return queryOne(
        `INSERT INTO productos (nombre, precio, imagen, stock, categoria_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [datos.nombre, datos.precio, datos.imagen ?? null, datos.stock, datos.categoriaId]
      );
    },

    actualizarProducto: async (_, { id, datos }, context) => {
      requerirAdmin(context);
      const existente = await queryOne('SELECT * FROM productos WHERE id = $1', [id]);
      if (!existente) return null;
      return queryOne(
        `UPDATE productos
           SET nombre = $1, precio = $2, imagen = $3, stock = $4, categoria_id = $5
         WHERE id = $6
         RETURNING *`,
        [datos.nombre, datos.precio, datos.imagen ?? null, datos.stock, datos.categoriaId, id]
      );
    },

    eliminarProducto: async (_, { id }, context) => {
      requerirAdmin(context);
      const rows = await query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
      return rows.length > 0;
    },

    crearPedido: async (_, { datos }, context) => {
      // El usuario del pedido ya NO viene del cliente: se toma del JWT.
      // Esto evita que alguien arme un pedido a nombre de otro usuario
      // con solo cambiar un "usuarioId" en la peticion (ver nota en schema.js).
      const usuario = requerirUsuario(context);

      if (!datos.detalles || datos.detalles.length === 0) {
        throw new Error('El pedido necesita al menos un renglon (producto + cantidad).');
      }

      // Resolvemos precios y total ANTES de insertar, dentro de una
      // transaccion real de Postgres, para que el pedido y sus renglones
      // queden consistentes (o no se crea nada, si algo falla).
      const pedidoId = await withTransaction(async (client) => {
        let total = 0;
        const renglones = [];
        for (const r of datos.detalles) {
          const producto = await client.queryOne('SELECT * FROM productos WHERE id = $1', [
            r.productoId,
          ]);
          if (!producto) {
            throw new Error(`No existe un producto con id ${r.productoId}`);
          }
          total += Number(producto.precio) * r.cantidad;
          renglones.push({
            productoId: producto.id,
            cantidad: r.cantidad,
            precioUnitario: producto.precio,
          });
        }

        const pedido = await client.queryOne(
          `INSERT INTO pedidos (usuario_id, total, status)
           VALUES ($1, $2, 'PENDING')
           RETURNING id`,
          [usuario.id, total]
        );

        for (const r of renglones) {
          await client.queryOne(
            `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [pedido.id, r.productoId, r.cantidad, r.precioUnitario]
          );
        }

        return pedido.id;
      });

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    iniciarSesionGoogle: async (_, { idToken }) => {
      const datosGoogle = await verificarIdTokenGoogle(idToken);
      const usuario = await buscarOCrearUsuarioGoogle(datosGoogle);
      const token = firmarToken(usuario);
      return { token, usuario };
    },
  },

  // ---------------------------------------------------------------
  // Resolvers de campo (relaciones)
  // ---------------------------------------------------------------

  Categoria: {
    productos: (categoria) =>
      query('SELECT * FROM productos WHERE categoria_id = $1 ORDER BY id', [categoria.id]),
  },

  Producto: {
    categoria: (producto) =>
      queryOne('SELECT * FROM categorias WHERE id = $1', [producto.categoria_id]),
  },

  Usuario: {
    avatarUrl: (usuario) => usuario.avatar_url,
    authProvider: (usuario) => usuario.auth_provider,
    pedidos: (usuario) =>
      query('SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY id', [usuario.id]),
  },

  Pedido: {
    usuario: (pedido) => queryOne('SELECT * FROM usuarios WHERE id = $1', [pedido.usuario_id]),
    detalles: (pedido) =>
      query('SELECT * FROM detalle_pedido WHERE pedido_id = $1 ORDER BY id', [pedido.id]),
    fecha: (pedido) => pedido.fecha,
  },

  DetallePedido: {
    producto: (detalle) =>
      queryOne('SELECT * FROM productos WHERE id = $1', [detalle.producto_id]),
    precioUnitario: (detalle) => detalle.precio_unitario,
    subtotal: (detalle) => detalle.cantidad * Number(detalle.precio_unitario),
  },
};
