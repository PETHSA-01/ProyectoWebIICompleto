import { db } from './db.js';

// ---------------------------------------------------------------
// Prepared statements (compiladas una sola vez, reusadas en cada resolver)
// ---------------------------------------------------------------

const stmts = {
  allCategorias: db.prepare('SELECT * FROM categorias ORDER BY id'),
  categoriaById: db.prepare('SELECT * FROM categorias WHERE id = ?'),
  productosByCategoria: db.prepare('SELECT * FROM productos WHERE categoria_id = ? ORDER BY id'),

  productosPage: db.prepare('SELECT * FROM productos ORDER BY id LIMIT ? OFFSET ?'),
  productoById: db.prepare('SELECT * FROM productos WHERE id = ?'),
  insertProducto: db.prepare(
    'INSERT INTO productos (nombre, precio, imagen, stock, categoria_id) VALUES (?, ?, ?, ?, ?)'
  ),
  updateProducto: db.prepare(
    'UPDATE productos SET nombre = ?, precio = ?, imagen = ?, stock = ?, categoria_id = ? WHERE id = ?'
  ),
  deleteProducto: db.prepare('DELETE FROM productos WHERE id = ?'),

  usuarioById: db.prepare('SELECT * FROM usuarios WHERE id = ?'),
  pedidosByUsuario: db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id'),

  allPedidos: db.prepare('SELECT * FROM pedidos ORDER BY id DESC'),
  pedidoById: db.prepare('SELECT * FROM pedidos WHERE id = ?'),
  insertPedido: db.prepare(
    "INSERT INTO pedidos (usuario_id, fecha, total, status) VALUES (?, datetime('now'), ?, 'PENDING')"
  ),

  detallesByPedido: db.prepare('SELECT * FROM detalle_pedido WHERE pedido_id = ? ORDER BY id'),
  insertDetalle: db.prepare(
    'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)'
  ),
};

export const resolvers = {
  Query: {
    // NOTA sobre N+1: esta query trae todas las categorias con una sola
    // consulta; pero como Categoria.productos hace una consulta POR
    // categoria (ver resolver de campo abajo), listar N categorias
    // termina ejecutando 1 + N consultas. Para un catalogo pequeño esto
    // es aceptable; se documenta la solucion (batching con DataLoader o
    // un JOIN + agrupado en memoria) en el reporte de la practica.
    categorias: () => stmts.allCategorias.all(),
    categoria: (_, { id }) => stmts.categoriaById.get(id) ?? null,

    productos: (_, { limite = 20, desde = 0 }) => stmts.productosPage.all(limite, desde),
    producto: (_, { id }) => stmts.productoById.get(id) ?? null,

    pedidos: () => stmts.allPedidos.all(),
  },

  Mutation: {
    crearProducto: (_, { datos }) => {
      const info = stmts.insertProducto.run(
        datos.nombre,
        datos.precio,
        datos.imagen ?? null,
        datos.stock,
        datos.categoriaId
      );
      return stmts.productoById.get(info.lastInsertRowid);
    },

    actualizarProducto: (_, { id, datos }) => {
      const existente = stmts.productoById.get(id);
      if (!existente) return null;
      stmts.updateProducto.run(
        datos.nombre,
        datos.precio,
        datos.imagen ?? null,
        datos.stock,
        datos.categoriaId,
        id
      );
      return stmts.productoById.get(id);
    },

    eliminarProducto: (_, { id }) => {
      const info = stmts.deleteProducto.run(id);
      return info.changes > 0;
    },

    crearPedido: (_, { datos }) => {
      const usuario = stmts.usuarioById.get(datos.usuarioId);
      if (!usuario) {
        throw new Error(`No existe un usuario con id ${datos.usuarioId}`);
      }
      if (!datos.detalles || datos.detalles.length === 0) {
        throw new Error('El pedido necesita al menos un renglon (producto + cantidad).');
      }

      // Resolvemos precios y total ANTES de insertar, dentro de una transaccion,
      // para que el pedido y sus renglones queden consistentes.
      const crear = db.transaction((datos) => {
        let total = 0;
        const renglones = datos.detalles.map((r) => {
          const producto = stmts.productoById.get(r.productoId);
          if (!producto) {
            throw new Error(`No existe un producto con id ${r.productoId}`);
          }
          total += producto.precio * r.cantidad;
          return { productoId: producto.id, cantidad: r.cantidad, precioUnitario: producto.precio };
        });

        const info = stmts.insertPedido.run(datos.usuarioId, total);
        const pedidoId = info.lastInsertRowid;

        for (const r of renglones) {
          stmts.insertDetalle.run(pedidoId, r.productoId, r.cantidad, r.precioUnitario);
        }

        return pedidoId;
      });

      const pedidoId = crear(datos);
      return stmts.pedidoById.get(pedidoId);
    },
  },

  // ---------------------------------------------------------------
  // Resolvers de campo (relaciones)
  // ---------------------------------------------------------------

  Categoria: {
    productos: (categoria) => stmts.productosByCategoria.all(categoria.id),
  },

  Producto: {
    categoria: (producto) => stmts.categoriaById.get(producto.categoria_id),
  },

  Usuario: {
    pedidos: (usuario) => stmts.pedidosByUsuario.all(usuario.id),
  },

  Pedido: {
    usuario: (pedido) => stmts.usuarioById.get(pedido.usuario_id),
    detalles: (pedido) => stmts.detallesByPedido.all(pedido.id),
    fecha: (pedido) => pedido.fecha,
  },

  DetallePedido: {
    producto: (detalle) => stmts.productoById.get(detalle.producto_id),
    precioUnitario: (detalle) => detalle.precio_unitario,
    subtotal: (detalle) => detalle.cantidad * detalle.precio_unitario,
  },
};
