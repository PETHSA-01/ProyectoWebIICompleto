// Actualizacion del estado de cobro/orden en la base, compartida por los
// flujos de Mercado Pago, PayPal y el panel administrativo.
//
// Regla de negocio:
//   - Un pago APROBADO confirma la orden (status CONFIRMED), guarda la
//     referencia/id del pago y la fecha en que se acredito, y genera los
//     asientos contables de la venta (una sola vez por pedido).
//   - Un pago RECHAZADO deja la orden en PENDING (el cliente puede volver a
//     intentarlo con otro metodo), solo se registra el estado del cobro.
//   - Al CANCELAR una orden que ya habia descontado stock, el stock se
//     devuelve al catalogo dejando su movimiento en el libro de inventario.
import { queryOne, withTransaction } from '../db.js';
import { registrarAsientosVenta } from '../contabilidad/asientos.js';
import { registrarMovimiento } from '../inventario/movimientos.js';

export async function marcarPagoAprobado(pedidoId, { metodoPago, idPago }, usuarioId = null) {
  return withTransaction(async (client) => {
    // Solo se "confirma" la orden si aun esta pendiente; un pedido ya
    // enviado/entregado no retrocede por un pago tardio.
    const pedido = await client.queryOne(
      `UPDATE pedidos
          SET estado_pago = 'APROBADO',
              id_pago = $2,
              fecha_pago = now(),
              status = CASE WHEN status = 'PENDING' THEN 'CONFIRMED' ELSE status END,
              metodo_pago = COALESCE($3, metodo_pago)
        WHERE id = $1
        RETURNING *`,
      [pedidoId, idPago, metodoPago]
    );
    if (!pedido) return null;

    // Asientos de la venta dentro de la MISMA transaccion del cobro: o queda
    // todo (pago + contabilidad) o no queda nada. La funcion es idempotente
    // por (origen, referencia_id), asi que un webhook repetido no duplica.
    const detalles = await client.query(
      'SELECT * FROM detalle_pedido WHERE pedido_id = $1',
      [pedidoId]
    );
    await registrarAsientosVenta(client, pedido, detalles, usuarioId);

    return pedido;
  });
}

export async function marcarPagoFallido(pedidoId) {
  return queryOne(
    `UPDATE pedidos
        SET estado_pago = 'RECHAZADO'
      WHERE id = $1
      RETURNING *`,
    [pedidoId]
  );
}

export async function marcarPagoCancelado(pedidoId) {
  return queryOne(
    `UPDATE pedidos
        SET estado_pago = 'CANCELADO'
      WHERE id = $1
      RETURNING *`,
    [pedidoId]
  );
}

/**
 * Devuelve al stock los renglones de una orden cancelada, dejando el
 * movimiento correspondiente en el libro de inventario.
 */
export async function devolverStock(pedidoId, usuarioId = null) {
  return withTransaction(async (client) => {
    const renglones = await client.query(
      'SELECT producto_id, cantidad FROM detalle_pedido WHERE pedido_id = $1',
      [pedidoId]
    );
    for (const r of renglones) {
      await registrarMovimiento(client, {
        productoId: r.producto_id,
        tipo: 'ENTRADA',
        cantidad: r.cantidad,
        origen: 'CANCELACION',
        referenciaId: pedidoId,
        usuarioId,
        motivo: `Devolucion por cancelacion del pedido #${pedidoId}`,
      });
    }
  });
}
