import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES } from '../lib/queries.js';
import {
  cuentaContableEs,
  formatoFechaHora,
  formatoMoneda,
  formatoPorcentaje,
} from '../lib/formatos.js';
import { Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';

const PRESETS = [
  ['mes', 'Este mes'],
  ['trimestre', 'Últimos 3 meses'],
  ['anio', 'Este año'],
  ['todo', 'Todo el histórico'],
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaISO(fecha) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function rangoDe(preset) {
  const hoy = new Date();
  if (preset === 'todo') return { desde: null, hasta: null };
  if (preset === 'anio') {
    return { desde: `${hoy.getFullYear()}-01-01`, hasta: fechaISO(hoy) };
  }
  if (preset === 'trimestre') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    return { desde: fechaISO(inicio), hasta: fechaISO(hoy) };
  }
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: fechaISO(inicio), hasta: fechaISO(hoy) };
}

/**
 * Reportes gerenciales: estado de resultados, serie mensual, rotación de
 * inventario y libro contable. Solo ADMIN (el OPERADOR no ve finanzas).
 *
 * Reglas visibles en pantalla:
 *   - El IVA no es ingreso.
 *   - Los pedidos históricos (sin costo registrado) suman ingresos pero se
 *     excluyen del margen, con nota explícita.
 */
export default function AdminReportes() {
  const [preset, setPreset] = useState('trimestre');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (valor) => {
    try {
      setError(null);
      const { desde, hasta } = rangoDe(valor);
      const data = await graphqlRequest(QUERIES.reportesAdmin, { desde, hasta });
      setDatos(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar(preset);
  }, [cargar, preset]);

  const resultado = datos?.estadoResultados;
  const rotacion = datos?.rotacionInventario || [];
  const movimientos = (datos?.movimientosContables || []).slice(0, 20);

  const totalesRotacion = useMemo(() => {
    return rotacion.reduce(
      (acc, r) => ({
        unidades: acc.unidades + r.unidadesVendidas,
        utilidad: acc.utilidad + r.utilidad,
        bajas: acc.bajas + (r.bajaRotacion ? 1 : 0),
      }),
      { unidades: 0, utilidad: 0, bajas: 0 }
    );
  }, [rotacion]);

  if (!datos && !error) return <Esqueleto filas={5} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Reportes</h1>
          <p className="panel-pagina__sub">
            Estado de resultados, rotación de inventario y libro contable.
          </p>
        </div>
        <div className="pills">
          {PRESETS.map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              className={`pill${preset === valor ? ' pill--activo' : ''}`}
              onClick={() => setPreset(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </header>

      <PanelError mensaje={error} />

      {resultado && (
        <>
          <div className="kpis">
            <Kpi etiqueta="Ingresos (sin IVA)" valor={formatoMoneda(resultado.ingresos)} />
            <Kpi etiqueta="Costo de ventas" valor={formatoMoneda(resultado.costoVentas)} />
            <Kpi
              etiqueta="Utilidad bruta"
              valor={formatoMoneda(resultado.utilidadBruta)}
              detalle={`Margen ${formatoPorcentaje(resultado.margenPorcentaje)}`}
              tono={resultado.utilidadBruta >= 0 ? 'ok' : 'alerta'}
            />
            <Kpi etiqueta="IVA trasladado" valor={formatoMoneda(resultado.ivaTrasladado)} />
          </div>

          {resultado.pedidosHistoricos > 0 && (
            <Nota tono="alerta">
              Hay <strong>{resultado.pedidosHistoricos}</strong> pedido(s) histórico(s) sin
              costo registrado. Sus ingresos ({formatoMoneda(resultado.ingresos - resultado.ingresosConCosto)})
              sí se suman al total, pero quedan <strong>fuera del margen y la utilidad</strong>{' '}
              para no inflar la ganancia. La base del margen es{' '}
              {formatoMoneda(resultado.ingresosConCosto)}.
            </Nota>
          )}

          <section className="dash-seccion">
            <div className="dash-seccion--header">
              <h2>Serie mensual</h2>
              <small className="celda-sub">Verde: ingresos · Azul: utilidad bruta</small>
            </div>
            <GraficaSerie serie={resultado.serieMensual} />
          </section>
        </>
      )}

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Rotación de inventario</h2>
          <small className="celda-sub">
            {totalesRotacion.unidades} unidades vendidas · {totalesRotacion.bajas} producto(s)
            sin rotación
          </small>
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Stock</th>
                <th className="num">Vendidas</th>
                <th className="num">Ingresos</th>
                <th className="num">Costo</th>
                <th className="num">Utilidad</th>
                <th className="num">Veces rotado</th>
                <th className="num">Días de inventario</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {rotacion.map((r) => (
                <tr key={r.producto.id}>
                  <td>
                    <strong>{r.producto.nombre}</strong>
                    <small className="celda-sub">{formatoMoneda(r.producto.precio)}</small>
                  </td>
                  <td className="num">{r.producto.stock}</td>
                  <td className="num">{r.unidadesVendidas}</td>
                  <td className="num">{formatoMoneda(r.ingresos)}</td>
                  <td className="num">{formatoMoneda(r.costo)}</td>
                  <td className="num">{formatoMoneda(r.utilidad)}</td>
                  <td className="num">{r.vecesRotado.toFixed(2)}</td>
                  <td className="num">{r.diasInventario > 0 ? r.diasInventario.toFixed(1) : '—'}</td>
                  <td>
                    {r.bajaRotacion ? (
                      <span className="badge badge--bad">Sin rotación</span>
                    ) : (
                      <span className="badge badge--ok">Rota</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rotacion.length === 0 && <p className="panel-vacio">No hay productos activos.</p>}
        </div>
        <Nota>
          La rotación usa el stock actual (no hay histórico de stock promedio) y las
          ventas pagadas del periodo. Los días de inventario son una aproximación a 30
          días.
        </Nota>
      </section>

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Libro contable</h2>
          <small className="celda-sub">Últimos 20 asientos · nunca se borran</small>
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cuenta</th>
                <th>Concepto</th>
                <th>Origen</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{formatoFechaHora(m.fecha)}</td>
                  <td>
                    <span className={`badge badge--${m.tipo === 'CARGO' ? 'refund' : 'ok'}`}>
                      {m.tipo === 'CARGO' ? 'Cargo' : 'Abono'}
                    </span>
                  </td>
                  <td>{cuentaContableEs(m.cuenta)}</td>
                  <td>
                    {m.concepto}
                    <small className="celda-sub">
                      {m.origen} #{m.referenciaId}
                    </small>
                  </td>
                  <td>{m.origen}</td>
                  <td className="num">{formatoMoneda(m.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movimientos.length === 0 && (
            <p className="panel-vacio">Todavía no hay asientos contables.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function GraficaSerie({ serie }) {
  if (!serie || serie.length === 0) {
    return <p className="panel-vacio">Sin ventas en el periodo.</p>;
  }

  const ancho = 640;
  const alto = 220;
  const margen = { arriba: 16, derecha: 16, abajo: 34, izquierda: 16 };
  const utilAncho = ancho - margen.izquierda - margen.derecha;
  const utilAlto = alto - margen.arriba - margen.abajo;
  const maximo = Math.max(...serie.flatMap((p) => [p.ingresos, p.utilidad]), 1);
  const paso = utilAncho / serie.length;
  const anchoBarra = Math.min(26, paso / 3.2);

  return (
    <div className="grafica">
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Ingresos y utilidad por mes">
        {[0, 0.25, 0.5, 0.75, 1].map((fraccion) => {
          const y = margen.arriba + utilAlto * (1 - fraccion);
          return (
            <g key={fraccion}>
              <line
                x1={margen.izquierda}
                x2={ancho - margen.derecha}
                y1={y}
                y2={y}
                className="grafica__linea"
              />
              <text x={margen.izquierda} y={y - 4} className="grafica__eje">
                {formatoMoneda(maximo * fraccion).replace('MX$', '$')}
              </text>
            </g>
          );
        })}

        {serie.map((punto, i) => {
          const centro = margen.izquierda + paso * i + paso / 2;
          const altoIngreso = (punto.ingresos / maximo) * utilAlto;
          const altoUtilidad = (Math.max(punto.utilidad, 0) / maximo) * utilAlto;
          const [anio, mes] = punto.mes.split('-');
          return (
            <g key={punto.mes}>
              <rect
                x={centro - anchoBarra - 2}
                y={margen.arriba + utilAlto - altoIngreso}
                width={anchoBarra}
                height={altoIngreso}
                rx="4"
                className="grafica__barra grafica__barra--ingreso"
              >
                <title>{`Ingresos ${punto.mes}: ${formatoMoneda(punto.ingresos)}`}</title>
              </rect>
              <rect
                x={centro + 2}
                y={margen.arriba + utilAlto - altoUtilidad}
                width={anchoBarra}
                height={altoUtilidad}
                rx="4"
                className="grafica__barra grafica__barra--utilidad"
              >
                <title>{`Utilidad ${punto.mes}: ${formatoMoneda(punto.utilidad)}`}</title>
              </rect>
              <text
                x={centro}
                y={alto - margen.abajo + 18}
                textAnchor="middle"
                className="grafica__eje grafica__eje--mes"
              >
                {MESES[Number(mes) - 1]} {anio.slice(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
