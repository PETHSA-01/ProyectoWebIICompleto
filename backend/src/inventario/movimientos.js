// Libro de inventario: UNICO punto de entrada para mover stock.
//
// Antes cada flujo actualizaba `productos.stock` por su cuenta (crear pedido,
// devolver stock al cancelar); eso es como un inventario se desincroniza. A
// partir del ERP, todo movimiento pasa por `registrarMovimiento`, que dentro
// de la transaccion del llamador:
//   1. bloquea la fila del producto (FOR UPDATE),
//   2. valida que el stock no quede negativo,
//   3. actualiza `productos.stock`, y
//   4. agrega un renglon al libro `movimientos_inventario`.
//
// `cantidad` se guarda CON SIGNO (ENTRADA positiva, SALIDA negativa), de modo
// que SUM(cantidad) por producto siempre reconstruye el stock actual.

/**
 * @param {object} client  cliente de la transaccion (withTransaction)
 * @param {object} mov     { productoId, tipo, cantidad, origen, referenciaId, usuarioId, motivo }
 *   - tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'
 *   - cantidad: entero > 0 para ENTRADA/SALIDA; con signo para AJUSTE
 * @returns {Promise<object>} el renglon insertado en movimientos_inventario
 */
export async function registrarMovimiento(
  client,
  { productoId, tipo, cantidad, origen, referenciaId = null, usuarioId = null, motivo = null }
) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n === 0) {
    throw new Error('La cantidad del movimiento debe ser un entero distinto de cero.');
  }

  // ENTRADA y SALIDA reciben la cantidad en positivo; el signo lo pone el
  // tipo. AJUSTE recibe el delta con signo (ej. -3 por merma).
  const delta = tipo === 'ENTRADA' ? Math.abs(n) : tipo === 'SALIDA' ? -Math.abs(n) : n;

  const producto = await client.queryOne(
    'SELECT id, nombre, stock FROM productos WHERE id = $1 FOR UPDATE',
    [productoId]
  );
  if (!producto) {
    throw new Error(`No existe un producto con id ${productoId}.`);
  }

  const nuevoStock = Number(producto.stock) + delta;
  if (nuevoStock < 0) {
    throw new Error(
      `El movimiento dejaria "${producto.nombre}" con stock ${nuevoStock} (no puede ser negativo).`
    );
  }

  await client.queryOne('UPDATE productos SET stock = $2 WHERE id = $1', [
    productoId,
    nuevoStock,
  ]);

  return client.queryOne(
    `INSERT INTO movimientos_inventario
       (producto_id, tipo, cantidad, origen, referencia_id, motivo, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [productoId, tipo, delta, origen, referenciaId, motivo, usuarioId]
  );
}
