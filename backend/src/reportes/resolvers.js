// Resolvers del Modulo 5 — Reportes gerenciales.
//
// Reglas heredadas de finanzas:
//   - El IVA no es ingreso.
//   - Los pedidos historicos (sin costo snapshot) suman ingresos pero NO
//     entran al margen: mezclarlos daria una utilidad falsamente alta.
//   - La rotacion es aproximada con el stock ACTUAL (no hay historico de
//     stock promedio); se documenta en el reporte.
import { query, queryOne } from '../db.js';
import { requerirAdmin, requerirPanel } from '../auth/context.js';

const RANGO = `($1::date IS NULL OR p.fecha >= $1::date)
           AND ($2::date IS NULL OR p.fecha < ($2::date + INTERVAL '1 day'))`;

export const resolversReportes = {
  Query: {
    rotacionInventario: async (_, { desde, hasta }, context) => {
      requerirAdmin(context);
      const filas = await query(
        `SELECT pr.*,
                COALESCE(v.unidades, 0) AS unidades_vendidas,
                COALESCE(v.ingresos, 0) AS ingresos,
                COALESCE(v.costo, 0) AS costo
           FROM productos pr
           LEFT JOIN (
             SELECT d.producto_id,
                    SUM(d.cantidad)::int AS unidades,
                    SUM(d.cantidad * d.precio_unitario) AS ingresos,
                    SUM(d.cantidad * COALESCE(d.costo_unitario_snapshot, 0)) AS costo
               FROM detalle_pedido d
               JOIN pedidos p ON p.id = d.pedido_id
              WHERE p.estado_pago = 'APROBADO' AND p.status <> 'CANCELLED'
                AND ${RANGO}
              GROUP BY d.producto_id
           ) v ON v.producto_id = pr.id
          WHERE pr.activo
          ORDER BY unidades_vendidas DESC, pr.nombre ASC`,
        [desde ?? null, hasta ?? null]
      );

      return filas.map((f) => {
        const stock = Number(f.stock || 0);
        const unidades = Number(f.unidades_vendidas || 0);
        const costo = Number(f.costo || 0);
        const ingresos = Number(f.ingresos || 0);
        const veces = stock > 0 ? unidades / stock : 0;
        return {
          producto: f,
          unidadesVendidas: unidades,
          ingresos,
          costo,
          utilidad: ingresos - costo,
          vecesRotado: Math.round(veces * 100) / 100,
          diasInventario: veces > 0 ? Math.round((30 / veces) * 10) / 10 : 0,
          bajaRotacion: unidades === 0 && stock > 0,
        };
      });
    },

    resumenDashboard: async (_, __, context) => {
      requerirPanel(context);
      const [mes, costo, bajo, atender, ocPend] = await Promise.all([
        queryOne(
          `SELECT COALESCE(SUM(p.subtotal), 0) AS ingresos,
                  COUNT(*) FILTER (
                    WHERE NOT EXISTS (
                      SELECT 1 FROM detalle_pedido d
                       WHERE d.pedido_id = p.id AND d.costo_unitario_snapshot IS NULL
                    )
                  ) AS pedidos_con_costo,
                  COALESCE(SUM(CASE WHEN NOT EXISTS (
                      SELECT 1 FROM detalle_pedido d
                       WHERE d.pedido_id = p.id AND d.costo_unitario_snapshot IS NULL
                    ) THEN p.subtotal ELSE 0 END), 0) AS ingresos_con_costo
             FROM pedidos p
            WHERE p.estado_pago = 'APROBADO' AND p.status <> 'CANCELLED'
              AND p.fecha >= date_trunc('month', now())`
        ),
        queryOne(
          `SELECT COALESCE(SUM(d.cantidad * COALESCE(d.costo_unitario_snapshot, 0)), 0) AS costo
             FROM detalle_pedido d
             JOIN pedidos p ON p.id = d.pedido_id
            WHERE p.estado_pago = 'APROBADO' AND p.status <> 'CANCELLED'
              AND p.fecha >= date_trunc('month', now())`
        ),
        queryOne(
          `SELECT COUNT(*)::int AS n FROM productos
            WHERE activo AND stock <= stock_minimo`
        ),
        queryOne(
          `SELECT COUNT(*)::int AS n FROM pedidos
            WHERE status IN ('PENDING', 'CONFIRMED')`
        ),
        queryOne(
          `SELECT COUNT(*)::int AS n FROM ordenes_compra WHERE estado = 'BORRADOR'`
        ),
      ]);

      const ingresosConCosto = Number(mes.ingresos_con_costo || 0);
      const utilidad = ingresosConCosto - Number(costo.costo || 0);
      return {
        utilidadMes: utilidad,
        margenMes: ingresosConCosto > 0 ? (utilidad / ingresosConCosto) * 100 : 0,
        productosBajoMinimo: Number(bajo.n || 0),
        pedidosPorAtender: Number(atender.n || 0),
        ordenesCompraPendientes: Number(ocPend.n || 0),
      };
    },
  },

  RotacionProducto: {
    unidadesVendidas: (r) => Number(r.unidadesVendidas || 0),
    ingresos: (r) => Number(r.ingresos || 0),
    costo: (r) => Number(r.costo || 0),
    utilidad: (r) => Number(r.utilidad || 0),
    vecesRotado: (r) => Number(r.vecesRotado || 0),
    diasInventario: (r) => Number(r.diasInventario || 0),
    bajaRotacion: (r) => Boolean(r.bajaRotacion),
  },

  EstadoResultados: {
    ingresos: (e) => Number(e.ingresos || 0),
    costoVentas: (e) => Number(e.costoVentas || 0),
    utilidadBruta: (e) => Number(e.utilidadBruta || 0),
    margenPorcentaje: (e) => Number(e.margenPorcentaje || 0),
    ivaTrasladado: (e) => Number(e.ivaTrasladado || 0),
    ingresosConCosto: (e) => Number(e.ingresosConCosto || 0),
    pedidosHistoricos: (e) => Number(e.pedidosHistoricos || 0),
    renglonesSinCosto: (e) => Number(e.renglonesSinCosto || 0),
    serieMensual: (e) => e.serieMensual || [],
  },
};
