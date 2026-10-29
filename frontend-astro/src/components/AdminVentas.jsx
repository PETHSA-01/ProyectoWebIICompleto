import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoCobroEs,
  estadoEnvioEs,
  formatoFecha,
  formatoMoneda,
  metodoPagoEs,
  tonoCobro,
  tonoEnvio,
} from '../lib/formatos.js';
import {
  Datos,
  Drawer,
  Esqueleto,
  Kpi,
  Nota,
  PanelError,
  descargarArchivo,
} from './AdminComunes.jsx';
import { IconoDescargar } from './Iconos.jsx';

const FILTROS = [
  ['pagadas', 'Pagadas'],
  ['todas', 'Todas'],
];

function costoDe(pedido) {
  return (pedido.detalles || []).reduce(
    (s, d) => s + Number(d.costoUnitarioSnapshot || 0) * d.cantidad,
    0
  );
}

/**
 * Ventas: pedidos con su desglose fiscal (subtotal / IVA / envío / total), su
 * costo snapshot y su margen. Desde aquí se emite la factura CFDI 4.0 de un
 * pedido pagado.
 */
export default function AdminVentas() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('pagadas');
  const [drawer, setDrawer] = useState(null); // { pedido, factura? }
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.ventasAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pedidos = useMemo(() => {
    const lista = (datos?.pedidos || []).filter((p) => p.status !== 'CANCELLED');
    if (filtro === 'pagadas') return lista.filter((p) => p.estadoPago === 'APROBADO');
    return lista;
  }, [datos, filtro]);

  const resumen = useMemo(() => {
    const pagados = (datos?.pedidos || []).filter(
      (p) => p.estadoPago === 'APROBADO' && p.status !== 'CANCELLED'
    );
    const ingresos = pagados.reduce((s, p) => s + p.subtotal, 0);
    const iva = pagados.reduce((s, p) => s + p.impuestos, 0);
    const costo = pagados.reduce((s, p) => s + costoDe(p), 0);
    const utilidad = ingresos - costo;
    return {
      ingresos,
      iva,
      costo,
      utilidad,
      margen: ingresos > 0 ? (utilidad / ingresos) * 100 : 0,
      pendientes: (datos?.pedidos || []).filter(
        (p) => p.estadoPago !== 'APROBADO' && p.status !== 'CANCELLED'
      ).length,
    };
  }, [datos]);

  const cerrar = () => {
    setDrawer(null);
    setErrorDrawer(null);
  };

  const emitir = async (pedido, datosFiscales) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      const data = await graphqlRequest(MUTATIONS.emitirFactura, {
        pedidoId: pedido.id,
        datos: datosFiscales,
      });
      await cargar();
      setDrawer({ pedido, factura: data.emitirFactura });
    } catch (err) {
      setErrorDrawer(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={5} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Ventas</h1>
          <p className="panel-pagina__sub">
            Desglose de cada pedido: subtotal, IVA, envío, costo y margen.
          </p>
        </div>
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi etiqueta="Ingresos (sin IVA)" valor={formatoMoneda(resumen.ingresos)} />
        <Kpi etiqueta="IVA trasladado" valor={formatoMoneda(resumen.iva)} />
        <Kpi
          etiqueta="Utilidad bruta"
          valor={formatoMoneda(resumen.utilidad)}
          detalle={`Margen ${resumen.margen.toFixed(1)}%`}
          tono={resumen.utilidad >= 0 ? 'ok' : 'alerta'}
        />
        <Kpi
          etiqueta="Por cobrar"
          valor={resumen.pendientes}
          detalle="Pedidos sin pago aprobado"
          tono={resumen.pendientes ? 'alerta' : undefined}
        />
      </div>

      <Nota>
        El IVA no es ingreso. El margen se calcula con el costo congelado al
        momento de la venta; los pedidos históricos sin costo no entran al margen.
      </Nota>

      <div className="pills">
        {FILTROS.map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            className={`pill${filtro === valor ? ' pill--activo' : ''}`}
            onClick={() => setFiltro(valor)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="tabla-scroll">
        <table className="tabla tabla--clickeable">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Pago</th>
              <th className="num">Subtotal</th>
              <th className="num">IVA</th>
              <th className="num">Envío</th>
              <th className="num">Total</th>
              <th className="num">Margen</th>
              <th>Factura</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => {
              const costo = costoDe(p);
              const margen = p.subtotal > 0 ? ((p.subtotal - costo) / p.subtotal) * 100 : 0;
              return (
                <tr key={p.id} onClick={() => setDrawer({ pedido: p })}>
                  <td>
                    <strong>#{p.id}</strong>
                    <small className="celda-sub">{estadoEnvioEs(p.status)}</small>
                  </td>
                  <td>{formatoFecha(p.fecha)}</td>
                  <td>{p.usuario?.nombre}</td>
                  <td>
                    <span className={`badge badge--${tonoCobro(p.estadoPago)}`}>
                      {estadoCobroEs(p.estadoPago)}
                    </span>
                  </td>
                  <td className="num">{formatoMoneda(p.subtotal)}</td>
                  <td className="num">{formatoMoneda(p.impuestos)}</td>
                  <td className="num">{formatoMoneda(p.costoEnvio)}</td>
                  <td className="num">
                    <strong>{formatoMoneda(p.total)}</strong>
                  </td>
                  <td className="num">{margen.toFixed(1)}%</td>
                  <td>
                    {p.factura ? (
                      <span className="badge badge--ok">
                        {p.factura.serie}-{p.factura.folio}
                      </span>
                    ) : p.estadoPago === 'APROBADO' ? (
                      <span className="badge badge--pending">Por facturar</span>
                    ) : (
                      <span className="badge badge--neutral">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pedidos.length === 0 && <p className="panel-vacio">No hay pedidos en este filtro.</p>}
      </div>

      {drawer && (
        <DetalleVenta
          pedido={drawer.pedido}
          factura={drawer.factura}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrar}
          onEmitir={(fiscales) => emitir(drawer.pedido, fiscales)}
        />
      )}
    </div>
  );
}

const FISCAL_VACIO = {
  rfc: 'XAXX010101000',
  razonSocial: 'Público en General',
  regimenFiscal: '616',
  usoCfdi: 'S01',
  codigoPostalFiscal: '45670',
  serie: 'A',
};

function DetalleVenta({ pedido, factura, onCerrar, onEmitir, guardando, error }) {
  const [fiscales, setFiscales] = useState(FISCAL_VACIO);
  const [verXml, setVerXml] = useState(Boolean(factura?.xml));
  const costo = costoDe(pedido);
  const margen = pedido.subtotal > 0 ? ((pedido.subtotal - costo) / pedido.subtotal) * 100 : 0;

  return (
    <Drawer titulo={`Pedido #${pedido.id}`} ancho={620} onCerrar={onCerrar}>
      <div className="form-grid">
        <Datos
          filas={[
            ['Cliente', pedido.usuario?.nombre],
            ['Correo', pedido.usuario?.email],
            ['Fecha', formatoFecha(pedido.fecha)],
            ['Estado del pedido', estadoEnvioEs(pedido.status)],
            ['Cobro', estadoCobroEs(pedido.estadoPago)],
            ['Método de pago', metodoPagoEs(pedido.metodoPago)],
          ]}
        />

        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cant.</th>
                <th className="num">Precio</th>
                <th className="num">Costo unit.</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pedido.detalles.map((d, i) => (
                <tr key={i}>
                  <td>{d.producto?.nombre}</td>
                  <td className="num">{d.cantidad}</td>
                  <td className="num">{formatoMoneda(d.precioUnitario)}</td>
                  <td className="num">
                    {d.costoUnitarioSnapshot == null ? (
                      <span className="badge badge--neutral">Sin costo</span>
                    ) : (
                      formatoMoneda(d.costoUnitarioSnapshot)
                    )}
                  </td>
                  <td className="num">{formatoMoneda(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="totales-caja">
          <div>
            <span>Subtotal</span>
            <span>{formatoMoneda(pedido.subtotal)}</span>
          </div>
          <div>
            <span>IVA ({(pedido.tasaImpuesto * 100).toFixed(0)}%)</span>
            <span>{formatoMoneda(pedido.impuestos)}</span>
          </div>
          <div>
            <span>Envío</span>
            <span>{formatoMoneda(pedido.costoEnvio)}</span>
          </div>
          <div className="totales-caja__total">
            <span>Total cobrado</span>
            <strong>{formatoMoneda(pedido.total)}</strong>
          </div>
        </div>

        <div className="ficha">
          <div>
            <small>Costo de la venta</small>
            <strong>{formatoMoneda(costo)}</strong>
          </div>
          <div>
            <small>Utilidad bruta</small>
            <strong>{formatoMoneda(pedido.subtotal - costo)}</strong>
          </div>
          <div>
            <small>Margen</small>
            <strong>{margen.toFixed(1)}%</strong>
          </div>
        </div>

        {verXml && factura?.xml ? (
          <section className="xml-caja">
            <div className="xml-caja__cabecera">
              <strong>
                CFDI 4.0 {factura.serie}-{factura.folio}
              </strong>
              <button
                type="button"
                className="boton-mini"
                onClick={() =>
                  descargarArchivo(`CFDI-${factura.serie}${factura.folio}.xml`, factura.xml)
                }
              >
                <IconoDescargar /> Descargar XML
              </button>
            </div>
            <pre className="xml-caja__pre">{factura.xml}</pre>
            <Nota tono="alerta">
              Factura SIN timbrar: el UUID fiscal queda pendiente. El timbrado real
              requiere un PAC con contrato y CSD; no se simula un timbre.
            </Nota>
          </section>
        ) : pedido.factura || factura ? (
          <Nota>
            Este pedido ya tiene factura {pedido.factura?.serie}-{pedido.factura?.folio}. El XML
            completo está en <a href="/admin/facturacion">Facturación</a>.
          </Nota>
        ) : pedido.estadoPago !== 'APROBADO' ? (
          <Nota tono="alerta">Solo se puede facturar un pedido con pago aprobado.</Nota>
        ) : (
          <section className="form-grid">
            <h3 className="subtitulo">Emitir factura CFDI 4.0</h3>
            <div className="form-grid-2">
              <label className="campo">
                RFC
                <input
                  value={fiscales.rfc}
                  onChange={(e) => setFiscales({ ...fiscales, rfc: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="campo">
                Serie
                <input
                  value={fiscales.serie}
                  maxLength={10}
                  onChange={(e) => setFiscales({ ...fiscales, serie: e.target.value.toUpperCase() })}
                />
              </label>
            </div>
            <label className="campo">
              Razón social
              <input
                value={fiscales.razonSocial}
                onChange={(e) => setFiscales({ ...fiscales, razonSocial: e.target.value })}
              />
            </label>
            <div className="form-grid-2">
              <label className="campo">
                Régimen fiscal
                <select
                  value={fiscales.regimenFiscal}
                  onChange={(e) => setFiscales({ ...fiscales, regimenFiscal: e.target.value })}
                >
                  <option value="601">601 · General de Ley Personas Morales</option>
                  <option value="612">612 · Personas Físicas con Actividades Empresariales</option>
                  <option value="616">616 · Sin obligaciones fiscales</option>
                  <option value="626">626 · RESICO</option>
                </select>
              </label>
              <label className="campo">
                Uso del CFDI
                <select
                  value={fiscales.usoCfdi}
                  onChange={(e) => setFiscales({ ...fiscales, usoCfdi: e.target.value })}
                >
                  <option value="G01">G01 · Adquisición de mercancías</option>
                  <option value="G03">G03 · Gastos en general</option>
                  <option value="I08">I08 · Otra maquinaria y equipo</option>
                  <option value="S01">S01 · Sin efectos fiscales</option>
                </select>
              </label>
            </div>
            <label className="campo">
              Código postal fiscal
              <input
                value={fiscales.codigoPostalFiscal}
                maxLength={5}
                onChange={(e) => setFiscales({ ...fiscales, codigoPostalFiscal: e.target.value })}
              />
            </label>
            <PanelError mensaje={error} />
            <button
              type="button"
              className="boton boton--primario"
              disabled={guardando}
              onClick={() => onEmitir(fiscales)}
            >
              {guardando ? 'Emitiendo…' : 'Emitir factura'}
            </button>
          </section>
        )}
      </div>
    </Drawer>
  );
}
