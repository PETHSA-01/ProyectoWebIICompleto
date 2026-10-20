// Contabilidad: asientos automaticos en partida doble (simplificada).
//
// Reglas del proyecto:
//   - Los asientos son INMUTABLES: se agregan, nunca se editan ni se borran.
//   - Se escriben UNA sola vez por hecho economico. La idempotencia se
//     garantiza buscando si ya existe un asiento con el mismo
//     (origen, referencia_id).
//   - El IVA NO es ingreso: se registra en su propia cuenta (IVA_TRASLADADO
//     al vender, IVA_ACREDITABLE al comprar). El estado de resultados se
//     calcula sobre subtotal, no sobre total.
//
// Cuentas:
//   CAJA / BANCO     dinero disponible
//   INVENTARIO       valor de la mercancia en almacen
//   COSTO_VENTAS     costo de la mercancia vendida
//   IVA_TRASLADADO   impuesto cobrado al cliente (se entera al SAT)
//   IVA_ACREDITABLE  impuesto pagado en compras (se acredita)

/** Inserta un asiento suelto y lo devuelve. */
export async function registrarAsiento(
  client,
  { tipo, cuenta, monto, concepto, origen, referenciaId = null, usuarioId = null }
) {
  return client.queryOne(
    `INSERT INTO movimientos_contables
       (tipo, cuenta, monto, concepto, origen, referencia_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [tipo, cuenta, Number(monto), concepto, origen, referenciaId, usuarioId]
  );
}

/** La cuenta de dinero depende del metodo de cobro. */
function cuentaDeCobro(metodoPago) {
  // OXXO (efectivo) y las pasarelas (tarjeta) se depositan en banco; el
  // efectivo en tienda iria a CAJA.
  return metodoPago === 'OXXO' ? 'BANCO' : 'BANCO';
}

/**
 * Asientos de una venta cobrada. Se llama desde `marcarPagoAprobado`, que ya
 * corre dentro de una transaccion, cuando el pago pasa a APROBADO.
 *
 * @param {object} pedido   fila de pedidos (con total, subtotal, impuestos, metodo_pago)
 * @param {Array}  detalles filas de detalle_pedido (con costo_unitario_snapshot)
 */
export async function registrarAsientosVenta(client, pedido, detalles, usuarioId = null) {
  const yaExiste = await client.queryOne(
    `SELECT 1 FROM movimientos_contables
      WHERE origen = 'PEDIDO' AND referencia_id = $1 LIMIT 1`,
    [pedido.id]
  );
  if (yaExiste) return []; // idempotencia: un pedido genera asientos una sola vez

  const costo = detalles.reduce(
    (suma, d) => suma + Number(d.costo_unitario_snapshot || 0) * Number(d.cantidad),
    0
  );
  const concepto = `Pedido #${pedido.id}`;

  const filas = [
    {
      tipo: 'INGRESO',
      cuenta: cuentaDeCobro(pedido.metodo_pago),
      monto: Number(pedido.total),
      concepto: `Cobro ${concepto}`,
    },
    {
      // Entra valor de inventario y sale el costo de ventas: la contrapartida
      // que permite calcular la utilidad bruta en los reportes.
      tipo: 'EGRESO',
      cuenta: 'INVENTARIO',
      monto: costo,
      concepto: `Salida de inventario ${concepto}`,
    },
    {
      tipo: 'INGRESO',
      cuenta: 'COSTO_VENTAS',
      monto: costo,
      concepto: `Costo de ventas ${concepto}`,
    },
  ];

  if (Number(pedido.impuestos) > 0) {
    filas.push({
      tipo: 'INGRESO',
      cuenta: 'IVA_TRASLADADO',
      monto: Number(pedido.impuestos),
      concepto: `IVA trasladado ${concepto}`,
    });
  }

  const escritos = [];
  for (const fila of filas) {
    escritos.push(
      await registrarAsiento(client, {
        ...fila,
        origen: 'PEDIDO',
        referenciaId: pedido.id,
        usuarioId,
      })
    );
  }
  return escritos;
}

/**
 * Reversa de una venta cancelada (solo si estaba pagada). No borra asientos:
 * escribe el inverso de cada uno con origen CANCELACION, una sola vez.
 */
export async function revertirAsientosVenta(client, pedido, usuarioId = null) {
  const yaExiste = await client.queryOne(
    `SELECT 1 FROM movimientos_contables
      WHERE origen = 'CANCELACION' AND referencia_id = $1 LIMIT 1`,
    [pedido.id]
  );
  if (yaExiste) return [];

  const previos = await client.query(
    `SELECT tipo, cuenta, monto FROM movimientos_contables
      WHERE origen = 'PEDIDO' AND referencia_id = $1
      ORDER BY id`,
    [pedido.id]
  );
  if (previos.length === 0) return []; // el pedido nunca se cobro

  const escritos = [];
  for (const anterior of previos) {
    escritos.push(
      await registrarAsiento(client, {
        tipo: anterior.tipo === 'INGRESO' ? 'EGRESO' : 'INGRESO',
        cuenta: anterior.cuenta,
        monto: anterior.monto,
        concepto: `Reversa cancelacion pedido #${pedido.id}`,
        origen: 'CANCELACION',
        referenciaId: pedido.id,
        usuarioId,
      })
    );
  }
  return escritos;
}

/**
 * Asientos de una orden de compra recibida: sale dinero (BANCO) y entra
 * mercancia (INVENTARIO) + IVA acreditable. Idempotente por (origen, ref).
 */
export async function registrarAsientosCompra(client, orden, usuarioId = null) {
  const yaExiste = await client.queryOne(
    `SELECT 1 FROM movimientos_contables
      WHERE origen = 'OC' AND referencia_id = $1 LIMIT 1`,
    [orden.id]
  );
  if (yaExiste) return [];

  const concepto = `Orden de compra #${orden.id}`;
  const filas = [
    {
      tipo: 'EGRESO',
      cuenta: 'BANCO',
      monto: Number(orden.total),
      concepto: `Pago a proveedor ${concepto}`,
    },
    {
      tipo: 'INGRESO',
      cuenta: 'INVENTARIO',
      monto: Number(orden.subtotal),
      concepto: `Entrada de inventario ${concepto}`,
    },
  ];
  if (Number(orden.impuestos) > 0) {
    filas.push({
      tipo: 'INGRESO',
      cuenta: 'IVA_ACREDITABLE',
      monto: Number(orden.impuestos),
      concepto: `IVA acreditable ${concepto}`,
    });
  }

  const escritos = [];
  for (const fila of filas) {
    escritos.push(
      await registrarAsiento(client, {
        ...fila,
        origen: 'OC',
        referenciaId: orden.id,
        usuarioId,
      })
    );
  }
  return escritos;
}
