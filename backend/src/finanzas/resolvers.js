// Resolvers del Modulo 2 — Finanzas y facturacion.
//
// Todo lo financiero exige requerirAdmin: el OPERADOR atiende el dia a dia
// (inventario, envios, pedidos) pero no ve ni mueve la contabilidad.
import { query, queryOne, withTransaction } from '../db.js';
import { requerirAdmin } from '../auth/context.js';
import { datosEmisor, generarCfdiXml, lineasDesdePedido } from './cfdi.js';
import { fechaHora } from '../util/fechas.js';

const CUENTAS = ['CAJA', 'BANCO', 'INVENTARIO', 'COSTO_VENTAS', 'IVA_TRASLADADO', 'IVA_ACREDITABLE'];

/** Valida un RFC mexicano (12 caracteres moral, 13 fisica). */
function validarRfc(rfc) {
  const limpio = String(rfc || '').trim().toUpperCase();
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(limpio)) {
    throw new Error('El RFC no tiene un formato valido (12 o 13 caracteres).');
  }
  return limpio;
}

async function detallesConNombre(client, pedidoId) {
  return (client || { query }).query(
    `SELECT d.*, p.nombre AS producto_nombre
       FROM detalle_pedido d
       JOIN productos p ON p.id = d.producto_id
      WHERE d.pedido_id = $1
      ORDER BY d.id`,
    [pedidoId]
  );
}

/** Filtro de fechas compartido por el libro y los reportes. */
const RANGO = `($1::date IS NULL OR p.fecha >= $1::date)
           AND ($2::date IS NULL OR p.fecha < ($2::date + INTERVAL '1 day'))`;

export const resolversFinanzas = {
  Query: {
    movimientosContables: (_, { desde, hasta, origen }, context) => {
      requerirAdmin(context);
      return query(
        `SELECT * FROM movimientos_contables
          WHERE ($1::date IS NULL OR fecha >= $1::date)
            AND ($2::date IS NULL OR fecha < ($2::date + INTERVAL '1 day'))
            AND ($3::text IS NULL OR origen = $3)
          ORDER BY id DESC
          LIMIT 1000`,
        [desde ?? null, hasta ?? null, origen ?? null]
      );
    },

    facturas: (_, __, context) => {
      requerirAdmin(context);
      return query('SELECT * FROM facturas ORDER BY id DESC');
    },

    estadoResultados: async (_, { desde, hasta }, context) => {
      requerirAdmin(context);
      // `con_costo` = el pedido tiene TODOS sus renglones con costo snapshot.
      // Solo esos pedidos entran al margen: un pedido historico (sin costo
      // registrado) si suma ingresos, pero mezclarlo inflaria la utilidad.
      const filas = await query(
        `WITH pedidos_periodo AS (
           SELECT p.id, p.subtotal, p.impuestos, date_trunc('month', p.fecha) AS mes,
                  NOT EXISTS (
                    SELECT 1 FROM detalle_pedido d
                     WHERE d.pedido_id = p.id AND d.costo_unitario_snapshot IS NULL
                  ) AS con_costo
             FROM pedidos p
            WHERE p.estado_pago = 'APROBADO' AND p.status <> 'CANCELLED'
              AND ${RANGO}
         ),
         costos AS (
           SELECT d.pedido_id,
                  SUM(d.cantidad * COALESCE(d.costo_unitario_snapshot, 0)) AS costo
             FROM detalle_pedido d
             JOIN pedidos_periodo pp ON pp.id = d.pedido_id
            GROUP BY d.pedido_id
         )
         SELECT
           COALESCE(SUM(pp.subtotal), 0) AS ingresos,
           COALESCE(SUM(pp.impuestos), 0) AS iva,
           COALESCE(SUM(CASE WHEN pp.con_costo THEN c.costo ELSE 0 END), 0) AS costo,
           COALESCE(SUM(CASE WHEN pp.con_costo THEN pp.subtotal ELSE 0 END), 0) AS ingresos_con_costo,
           COUNT(*) FILTER (WHERE NOT pp.con_costo)::int AS pedidos_historicos,
           to_char(pp.mes, 'YYYY-MM') AS mes,
           COALESCE(SUM(CASE WHEN pp.con_costo THEN c.costo ELSE 0 END), 0) AS costo_mes,
           COALESCE(SUM(CASE WHEN pp.con_costo THEN pp.subtotal ELSE 0 END), 0) AS ingresos_con_costo_mes
         FROM pedidos_periodo pp
         LEFT JOIN costos c ON c.pedido_id = pp.id
         GROUP BY pp.mes
         ORDER BY pp.mes`,
        [desde ?? null, hasta ?? null]
      );

      const total = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
      const ingresos = total('ingresos');
      const iva = total('iva');
      const costo = total('costo');
      const ingresosConCosto = total('ingresos_con_costo');
      const utilidad = ingresosConCosto - costo;

      return {
        ingresos,
        costoVentas: costo,
        utilidadBruta: utilidad,
        margenPorcentaje: ingresosConCosto > 0 ? (utilidad / ingresosConCosto) * 100 : 0,
        ivaTrasladado: iva,
        ingresosConCosto,
        pedidosHistoricos: filas.reduce((s, f) => s + Number(f.pedidos_historicos || 0), 0),
        renglonesSinCosto: filas.reduce((s, f) => s + Number(f.pedidos_historicos || 0), 0),
        serieMensual: filas.map((f) => ({
          mes: f.mes,
          ingresos: Number(f.ingresos || 0),
          iva: Number(f.iva || 0),
          costoVentas: Number(f.costo_mes || 0),
          utilidad: Number(f.ingresos_con_costo_mes || 0) - Number(f.costo_mes || 0),
        })),
      };
    },
  },

  Mutation: {
    emitirFactura: async (_, { pedidoId, datos }, context) => {
      const usuario = requerirAdmin(context);
      const rfc = validarRfc(datos.rfc);
      const razonSocial = (datos.razonSocial || '').trim();
      if (!razonSocial) throw new Error('La razon social es obligatoria.');
      const codigoPostalFiscal = String(datos.codigoPostalFiscal || '').trim();
      if (!/^\d{5}$/.test(codigoPostalFiscal)) {
        throw new Error('El codigo postal fiscal debe tener 5 digitos.');
      }

      return withTransaction(async (client) => {
        const pedido = await client.queryOne(
          'SELECT * FROM pedidos WHERE id = $1 FOR UPDATE',
          [pedidoId]
        );
        if (!pedido) throw new Error(`No existe el pedido ${pedidoId}.`);
        if (pedido.status === 'CANCELLED') {
          throw new Error('No se puede facturar un pedido cancelado.');
        }
        if (pedido.estado_pago !== 'APROBADO') {
          throw new Error('Solo se puede facturar un pedido ya pagado.');
        }
        const existente = await client.queryOne(
          'SELECT id FROM facturas WHERE pedido_id = $1',
          [pedidoId]
        );
        if (existente) {
          throw new Error(`El pedido ${pedidoId} ya tiene factura (#${existente.id}).`);
        }

        const detalles = await detallesConNombre(client, pedidoId);
        const lineas = lineasDesdePedido(pedido, detalles);
        const subtotal = lineas.reduce((s, l) => s + Number(l.importe || 0), 0);
        const impuestos = lineas.reduce((s, l) => s + Number(l.iva || 0), 0);
        const total = subtotal + impuestos;

        const folioFila = await client.queryOne(
          "SELECT nextval('folio_factura_seq') AS folio"
        );

        return client.queryOne(
          `INSERT INTO facturas
             (pedido_id, serie, folio, rfc, razon_social, regimen_fiscal, uso_cfdi,
              codigo_postal_fiscal, subtotal, impuestos, total, estado, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EMITIDA', $12)
           RETURNING *`,
          [
            pedidoId,
            (datos.serie || 'A').trim().toUpperCase().slice(0, 10),
            Number(folioFila.folio),
            rfc,
            razonSocial,
            String(datos.regimenFiscal || '601').trim(),
            String(datos.usoCfdi || 'G03').trim(),
            codigoPostalFiscal,
            subtotal,
            impuestos,
            total,
            usuario.id,
          ]
        );
      });
    },

    cancelarFactura: async (_, { id }, context) => {
      requerirAdmin(context);
      const factura = await queryOne('SELECT * FROM facturas WHERE id = $1', [id]);
      if (!factura) return null;
      if (factura.estado === 'CANCELADA') return factura;
      if (factura.uuid_fiscal) {
        // Con timbre, la cancelacion se hace ante el SAT con el PAC; aqui no
        // se simula. Sin timbre, solo se marca internamente.
        throw new Error(
          'Una factura timbrada debe cancelarse ante el SAT a traves del PAC.'
        );
      }
      return queryOne(
        `UPDATE facturas SET estado = 'CANCELADA' WHERE id = $1 RETURNING *`,
        [id]
      );
    },
  },

  MovimientoContable: {
    fecha: (m) => fechaHora(m.fecha),
    referenciaId: (m) => m.referencia_id,
    usuario: (m) =>
      m.usuario_id ? queryOne('SELECT * FROM usuarios WHERE id = $1', [m.usuario_id]) : null,
  },

  Factura: {
    pedido: (f) => queryOne('SELECT * FROM pedidos WHERE id = $1', [f.pedido_id]),
    razonSocial: (f) => f.razon_social,
    regimenFiscal: (f) => f.regimen_fiscal,
    usoCfdi: (f) => f.uso_cfdi,
    codigoPostalFiscal: (f) => f.codigo_postal_fiscal,
    uuidFiscal: (f) => f.uuid_fiscal,
    emitidaEn: (f) => fechaHora(f.emitida_en),
    xml: async (f) => {
      const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [f.pedido_id]);
      const detalles = await detallesConNombre(null, f.pedido_id);
      const lineas = lineasDesdePedido(pedido, detalles);
      return generarCfdiXml({ factura: f, lineas, emisor: datosEmisor() });
    },
  },

  Pedido: {
    subtotal: (p) => Number(p.subtotal ?? _totales(p).subtotal),
    impuestos: (p) => Number(p.impuestos || 0),
    tasaImpuesto: (p) => Number(p.tasa_impuesto ?? 0.16),
    costoEnvio: (p) => Number(p.costo_envio || 0),
    direccionEnvio: (p) => p.direccion_envio,
    ciudad: (p) => p.ciudad,
    estadoGeo: (p) => p.estado_geo,
    codigoPostal: (p) => p.codigo_postal,
    telefonoContacto: (p) => p.telefono_contacto,
    factura: (p) => queryOne('SELECT * FROM facturas WHERE pedido_id = $1', [p.id]),
  },
};

/** Pedidos historicos (antes del ERP) no traen subtotal: era el total cobrado. */
function _totales(pedido) {
  return { subtotal: pedido.total };
}
