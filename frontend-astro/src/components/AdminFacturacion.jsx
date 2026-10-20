import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoFacturaEs,
  formatoFecha,
  formatoMoneda,
  tonoFactura,
} from '../lib/formatos.js';
import {
  Drawer,
  Esqueleto,
  Kpi,
  Nota,
  PanelError,
  descargarArchivo,
} from './AdminComunes.jsx';
import { IconoDescargar } from './Iconos.jsx';

/**
 * Facturación: libro de facturas emitidas. Muestra el CFDI 4.0 completo y su
 * XML listo para timbrar. El UUID fiscal solo existe si un PAC timbró; aquí no
 * se simula un timbre falso (sería un delito fiscal, no una demo).
 */
export default function AdminFacturacion() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.facturacionAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    const lista = datos?.facturas || [];
    const emitidas = lista.filter((f) => f.estado === 'EMITIDA');
    return {
      emitidas: emitidas.length,
      canceladas: lista.filter((f) => f.estado === 'CANCELADA').length,
      facturado: emitidas.reduce((s, f) => s + f.total, 0),
      sinTimbre: lista.filter((f) => f.estado === 'EMITIDA' && !f.uuidFiscal).length,
    };
  }, [datos]);

  const cerrar = () => {
    setDrawer(null);
    setErrorDrawer(null);
  };

  const cancelar = async (factura) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      await graphqlRequest(MUTATIONS.cancelarFactura, { id: factura.id });
      await cargar();
      setDrawer(null);
    } catch (err) {
      setErrorDrawer(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={4} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Facturación</h1>
          <p className="panel-pagina__sub">
            CFDI 4.0 emitidos, XML descargable y estado del timbre fiscal.
          </p>
        </div>
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi etiqueta="Facturas emitidas" valor={resumen.emitidas} />
        <Kpi etiqueta="Total facturado" valor={formatoMoneda(resumen.facturado)} />
        <Kpi
          etiqueta="Pendientes de timbre"
          valor={resumen.sinTimbre}
          detalle="Requieren PAC + CSD"
          tono={resumen.sinTimbre ? 'alerta' : 'ok'}
        />
        <Kpi etiqueta="Canceladas" valor={resumen.canceladas} />
      </div>

      <Nota tono="alerta">
        El sistema genera el XML CFDI 4.0 completo, pero <strong>no timbra</strong>:
        el UUID fiscal se llena únicamente cuando se conecta un PAC real con
        credenciales en <code>.env</code>. Una factura sin UUID no es válida ante
        el SAT y así se muestra, sin fingir un timbre.
      </Nota>

      <div className="tabla-scroll">
        <table className="tabla tabla--clickeable">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Pedido</th>
              <th>RFC / Razón social</th>
              <th>Fecha</th>
              <th className="num">Subtotal</th>
              <th className="num">IVA</th>
              <th className="num">Total</th>
              <th>Estado</th>
              <th>UUID</th>
            </tr>
          </thead>
          <tbody>
            {(datos?.facturas || []).map((f) => (
              <tr key={f.id} onClick={() => setDrawer(f)}>
                <td>
                  <strong>
                    {f.serie}-{f.folio}
                  </strong>
                </td>
                <td>#{f.pedido?.id}</td>
                <td>
                  {f.rfc}
                  <small className="celda-sub">{f.razonSocial}</small>
                </td>
                <td>{formatoFecha(f.emitidaEn)}</td>
                <td className="num">{formatoMoneda(f.subtotal)}</td>
                <td className="num">{formatoMoneda(f.impuestos)}</td>
                <td className="num">
                  <strong>{formatoMoneda(f.total)}</strong>
                </td>
                <td>
                  <span className={`badge badge--${tonoFactura(f.estado)}`}>
                    {estadoFacturaEs(f.estado)}
                  </span>
                </td>
                <td>
                  {f.uuidFiscal ? (
                    <code className="uuid">{f.uuidFiscal}</code>
                  ) : (
                    <span className="badge badge--pending">Sin timbrar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(datos?.facturas || []).length === 0 && (
          <p className="panel-vacio">
            Todavía no hay facturas. Emite una desde <a href="/admin/ventas">Ventas</a>.
          </p>
        )}
      </div>

      {drawer && (
        <Drawer
          titulo={`Factura ${drawer.serie}-${drawer.folio}`}
          ancho={720}
          onCerrar={cerrar}
          pie={
            drawer.estado === 'EMITIDA' ? (
              <button
                type="button"
                className="boton boton--peligro"
                disabled={guardando || Boolean(drawer.uuidFiscal)}
                title={
                  drawer.uuidFiscal
                    ? 'Una factura timbrada se cancela ante el SAT'
                    : 'Cancelar la factura internamente'
                }
                onClick={() => cancelar(drawer)}
              >
                {guardando ? 'Cancelando…' : 'Cancelar factura'}
              </button>
            ) : null
          }
        >
          <div className="form-grid">
            <div className="ficha">
              <div>
                <small>RFC</small>
                <strong>{drawer.rfc}</strong>
              </div>
              <div>
                <small>Razón social</small>
                <strong>{drawer.razonSocial}</strong>
              </div>
              <div>
                <small>Régimen fiscal</small>
                <strong>{drawer.regimenFiscal}</strong>
              </div>
              <div>
                <small>Uso del CFDI</small>
                <strong>{drawer.usoCfdi}</strong>
              </div>
              <div>
                <small>CP fiscal</small>
                <strong>{drawer.codigoPostalFiscal}</strong>
              </div>
              <div>
                <small>Emitida</small>
                <strong>{formatoFecha(drawer.emitidaEn)}</strong>
              </div>
            </div>

            <div className="totales-caja">
              <div>
                <span>Subtotal</span>
                <span>{formatoMoneda(drawer.subtotal)}</span>
              </div>
              <div>
                <span>IVA trasladado</span>
                <span>{formatoMoneda(drawer.impuestos)}</span>
              </div>
              <div className="totales-caja__total">
                <span>Total</span>
                <strong>{formatoMoneda(drawer.total)}</strong>
              </div>
            </div>

            {drawer.uuidFiscal ? (
              <Nota>
                UUID fiscal: <code className="uuid">{drawer.uuidFiscal}</code>
              </Nota>
            ) : (
              <Nota tono="alerta">
                Sin UUID fiscal: el XML está listo, pero falta timbrarlo con un PAC.
              </Nota>
            )}

            <section className="xml-caja">
              <div className="xml-caja__cabecera">
                <strong>XML CFDI 4.0</strong>
                <button
                  type="button"
                  className="boton-mini"
                  onClick={() =>
                    descargarArchivo(`CFDI-${drawer.serie}${drawer.folio}.xml`, drawer.xml)
                  }
                >
                  <IconoDescargar /> Descargar
                </button>
              </div>
              <pre className="xml-caja__pre">{drawer.xml}</pre>
            </section>

            <PanelError mensaje={errorDrawer} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
