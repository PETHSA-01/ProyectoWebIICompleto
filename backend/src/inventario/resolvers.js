// Resolvers del Modulo 1 — Inventarios y almacen (compras / stock).
//
// Se exportan como mapas parciales; el archivo principal (resolvers.js) los
// combina con los existentes. Todo escribe con requerirPanel, salvo el
// directorio de proveedores, que maneja condiciones de credito y por eso
// exige requerirAdmin.
import { query, queryOne, withTransaction } from '../db.js';
import { requerirAdmin, requerirPanel } from '../auth/context.js';
import { registrarMovimiento } from './movimientos.js';
import { registrarAsientosCompra } from '../contabilidad/asientos.js';
import { fechaHora } from '../util/fechas.js';

const TASA_COMPRA = 0.16;

async function proveedorDe(id) {
  const proveedor = await queryOne('SELECT * FROM proveedores WHERE id = $1', [id]);
  if (!proveedor) throw new Error(`No existe un proveedor con id ${id}.`);
  return proveedor;
}

export const resolversInventario = {
  Query: {
    productosBajoMinimo: (_, __, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM productos
          WHERE activo AND stock <= stock_minimo
          ORDER BY (stock - stock_minimo) ASC, stock ASC`
      );
    },

    proveedores: (_, { activo }, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM proveedores
          WHERE ($1::boolean IS NULL OR activo = $1)
          ORDER BY activo DESC, nombre ASC`,
        [activo ?? null]
      );
    },

    proveedor: (_, { id }, context) => {
      requerirPanel(context);
      return queryOne('SELECT * FROM proveedores WHERE id = $1', [id]);
    },

    ordenesCompra: (_, { estado }, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM ordenes_compra
          WHERE ($1::text IS NULL OR estado = $1)
          ORDER BY id DESC`,
        [estado ?? null]
      );
    },

    ordenCompra: (_, { id }, context) => {
      requerirPanel(context);
      return queryOne('SELECT * FROM ordenes_compra WHERE id = $1', [id]);
    },

    movimientosInventario: (_, { productoId, tipo, limite = 100 }, context) => {
      requerirPanel(context);
      return query(
        `SELECT * FROM movimientos_inventario
          WHERE ($1::int IS NULL OR producto_id = $1)
            AND ($2::text IS NULL OR tipo = $2)
          ORDER BY id DESC
          LIMIT $3`,
        [productoId ?? null, tipo ?? null, Math.min(Math.max(Number(limite) || 100, 1), 500)]
      );
    },
  },

  Mutation: {
    crearProveedor: async (_, { datos }, context) => {
      requerirAdmin(context);
      const nombre = (datos.nombre || '').trim();
      if (!nombre) throw new Error('El nombre del proveedor es obligatorio.');
      return queryOne(
        `INSERT INTO proveedores
           (nombre, contacto, email, telefono, marcas_distribuidas,
            condiciones_pago, dias_credito, notas, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          nombre,
          datos.contacto ?? null,
          datos.email ?? null,
          datos.telefono ?? null,
          datos.marcasDistribuidas ?? null,
          datos.condicionesPago ?? 'CONTADO',
          datos.diasCredito ?? 0,
          datos.notas ?? null,
          datos.activo ?? true,
        ]
      );
    },

    actualizarProveedor: async (_, { id, datos }, context) => {
      requerirAdmin(context);
      const actual = await proveedorDe(id);
      const nombre = (datos.nombre ?? actual.nombre).trim();
      if (!nombre) throw new Error('El nombre del proveedor es obligatorio.');
      return queryOne(
        `UPDATE proveedores SET
           nombre = $1, contacto = $2, email = $3, telefono = $4,
           marcas_distribuidas = $5, condiciones_pago = $6,
           dias_credito = $7, notas = $8, activo = $9
         WHERE id = $10
         RETURNING *`,
        [
          nombre,
          datos.contacto ?? actual.contacto,
          datos.email ?? actual.email,
          datos.telefono ?? actual.telefono,
          datos.marcasDistribuidas ?? actual.marcas_distribuidas,
          datos.condicionesPago ?? actual.condiciones_pago,
          datos.diasCredito ?? actual.dias_credito,
          datos.notas ?? actual.notas,
          datos.activo ?? actual.activo,
          id,
        ]
      );
    },

    crearOrdenCompra: async (_, { proveedorId, renglones }, context) => {
      const usuario = requerirPanel(context);
      if (!renglones || renglones.length === 0) {
        throw new Error('La orden de compra necesita al menos un renglon.');
      }
      await proveedorDe(proveedorId);

      return withTransaction(async (client) => {
        let subtotal = 0;
        for (const r of renglones) {
          const cantidad = Number(r.cantidad);
          const costo = Number(r.costoUnitario);
          if (!Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error('Cada renglon necesita una cantidad entera mayor a cero.');
          }
          if (!Number.isFinite(costo) || costo < 0) {
            throw new Error('Cada renglon necesita un costo unitario mayor o igual a cero.');
          }
          const producto = await client.queryOne('SELECT id FROM productos WHERE id = $1', [
            r.productoId,
          ]);
          if (!producto) throw new Error(`No existe un producto con id ${r.productoId}.`);
          subtotal += cantidad * costo;
        }

        const impuestos = Math.round(subtotal * TASA_COMPRA * 100) / 100;
        const total = Math.round((subtotal + impuestos) * 100) / 100;

        const orden = await client.queryOne(
          `INSERT INTO ordenes_compra
             (proveedor_id, estado, subtotal, impuestos, total, usuario_id)
           VALUES ($1, 'BORRADOR', $2, $3, $4, $5)
           RETURNING *`,
          [proveedorId, subtotal, impuestos, total, usuario.id]
        );

        for (const r of renglones) {
          await client.queryOne(
            `INSERT INTO detalle_oc (oc_id, producto_id, cantidad, costo_unitario)
             VALUES ($1, $2, $3, $4)`,
            [orden.id, r.productoId, Number(r.cantidad), Number(r.costoUnitario)]
          );
        }
        return orden;
      });
    },

    recibirOrdenCompra: async (_, { id }, context) => {
      const usuario = requerirPanel(context);
      return withTransaction(async (client) => {
        const orden = await client.queryOne(
          'SELECT * FROM ordenes_compra WHERE id = $1 FOR UPDATE',
          [id]
        );
        if (!orden) throw new Error(`No existe la orden de compra ${id}.`);
        if (orden.estado !== 'BORRADOR') {
          throw new Error(`La orden ${id} ya esta ${orden.estado}; no se puede recibir otra vez.`);
        }

        const renglones = await client.query(
          'SELECT * FROM detalle_oc WHERE oc_id = $1 ORDER BY id',
          [id]
        );

        for (const r of renglones) {
          // Entra mercancia al inventario (y queda auditado con origen OC).
          await registrarMovimiento(client, {
            productoId: r.producto_id,
            tipo: 'ENTRADA',
            cantidad: r.cantidad,
            origen: 'OC',
            referenciaId: orden.id,
            usuarioId: usuario.id,
            motivo: `Recepcion de orden de compra #${orden.id}`,
          });
          // El costo de adquisicion del producto pasa a ser el ultimo costo
          // recibido; el historico completo vive en detalle_oc.
          await client.queryOne('UPDATE productos SET costo_adquisicion = $2 WHERE id = $1', [
            r.producto_id,
            r.costo_unitario,
          ]);
        }

        await registrarAsientosCompra(client, orden, usuario.id);

        return client.queryOne(
          `UPDATE ordenes_compra
              SET estado = 'RECIBIDA', recibida_en = now()
            WHERE id = $1
            RETURNING *`,
          [id]
        );
      });
    },

    cancelarOrdenCompra: async (_, { id }, context) => {
      requerirPanel(context);
      const orden = await queryOne('SELECT * FROM ordenes_compra WHERE id = $1', [id]);
      if (!orden) return null;
      if (orden.estado !== 'BORRADOR') {
        throw new Error('Solo se puede cancelar una orden de compra en BORRADOR.');
      }
      return queryOne(
        `UPDATE ordenes_compra SET estado = 'CANCELADA' WHERE id = $1 RETURNING *`,
        [id]
      );
    },

    ajustarStock: async (_, { productoId, cantidad, motivo }, context) => {
      const usuario = requerirPanel(context);
      if (!motivo || !motivo.trim()) {
        throw new Error('El motivo del ajuste es obligatorio (merma, robo, conteo fisico...).');
      }
      return withTransaction(async (client) => {
        await registrarMovimiento(client, {
          productoId,
          tipo: 'AJUSTE',
          cantidad: Number(cantidad),
          origen: 'AJUSTE_MANUAL',
          usuarioId: usuario.id,
          motivo: motivo.trim(),
        });
        return client.queryOne('SELECT * FROM productos WHERE id = $1', [productoId]);
      });
    },

    actualizarUmbralStock: async (_, { productoId, stockMinimo }, context) => {
      requerirPanel(context);
      const umbral = Number(stockMinimo);
      if (!Number.isInteger(umbral) || umbral < 0) {
        throw new Error('El stock minimo debe ser un entero mayor o igual a cero.');
      }
      const producto = await queryOne(
        'UPDATE productos SET stock_minimo = $2 WHERE id = $1 RETURNING *',
        [productoId, umbral]
      );
      if (!producto) throw new Error(`No existe un producto con id ${productoId}.`);
      return producto;
    },
  },

  Producto: {
    costoAdquisicion: (p) => Number(p.costo_adquisicion || 0),
    margen: (p) => {
      const precio = Number(p.precio);
      const costo = Number(p.costo_adquisicion || 0);
      if (precio <= 0) return 0;
      return Math.round(((precio - costo) / precio) * 10000) / 100;
    },
    sku: (p) => p.sku ?? null,
    stockMinimo: (p) => Number(p.stock_minimo ?? 5),
    bajoMinimo: (p) => Number(p.stock) <= Number(p.stock_minimo ?? 5),
    activo: (p) => p.activo !== false,
  },

  Proveedor: {
    marcasDistribuidas: (p) => p.marcas_distribuidas,
    condicionesPago: (p) => p.condiciones_pago,
    diasCredito: (p) => p.dias_credito,
    ordenesCompra: (p) =>
      query('SELECT * FROM ordenes_compra WHERE proveedor_id = $1 ORDER BY id DESC', [p.id]),
    saldoPendiente: async (p) => {
      if (!String(p.condiciones_pago || '').startsWith('CREDITO')) return 0;
      const fila = await queryOne(
        `SELECT COALESCE(SUM(total), 0) AS saldo
           FROM ordenes_compra
          WHERE proveedor_id = $1 AND estado = 'RECIBIDA'`,
        [p.id]
      );
      return Number(fila?.saldo || 0);
    },
  },

  OrdenCompra: {
    proveedor: (o) => queryOne('SELECT * FROM proveedores WHERE id = $1', [o.proveedor_id]),
    fecha: (o) => fechaHora(o.fecha),
    recibidaEn: (o) => fechaHora(o.recibida_en),
    usuario: (o) =>
      o.usuario_id ? queryOne('SELECT * FROM usuarios WHERE id = $1', [o.usuario_id]) : null,
    detalles: (o) => query('SELECT * FROM detalle_oc WHERE oc_id = $1 ORDER BY id', [o.id]),
  },

  DetalleOC: {
    producto: (d) => queryOne('SELECT * FROM productos WHERE id = $1', [d.producto_id]),
    costoUnitario: (d) => Number(d.costo_unitario),
    subtotal: (d) => Number(d.cantidad) * Number(d.costo_unitario),
  },

  MovimientoInventario: {
    producto: (m) => queryOne('SELECT * FROM productos WHERE id = $1', [m.producto_id]),
    referenciaId: (m) => m.referencia_id,
    fecha: (m) => fechaHora(m.fecha),
    usuario: (m) =>
      m.usuario_id ? queryOne('SELECT * FROM usuarios WHERE id = $1', [m.usuario_id]) : null,
  },
};
