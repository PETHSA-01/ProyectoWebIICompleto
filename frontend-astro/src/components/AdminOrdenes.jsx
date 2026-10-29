import { useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoCobroEs,
  estadoEnvioEs,
  formatoMoneda,
  tonoCobro,
  tonoEnvio,
} from '../lib/formatos.js';
import { IconoCerrar, IconoFlecha } from './Iconos.jsx';

const TRANSICIONES = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const FILTROS = [
  ['', 'Todos'],
  ['PENDING', 'Pendiente'],
  ['CONFIRMED', 'Confirmado'],
  ['SHIPPED', 'Enviado'],
  ['DELIVERED', 'Entregado'],
  ['CANCELLED', 'Cancelado'],
];

function Esqueleto() {
  return (
    <div className="skeleton">
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
    </div>
  );
}

/** Órdenes del panel: pills de filtro por envío + tabla que abre un drawer. */
export default function AdminOrdenes() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [detalleId, setDetalleId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const cargarPedidos = async (estado) => {
    const d = await graphqlRequest(QUERIES.pedidosAdmin, estado ? { estado } : {});
    setPedidos(d.pedidos);
  };

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);
    setDetalle(null);
    setDetalleId(null);
    graphqlRequest(QUERIES.pedidosAdmin, filtro ? { estado: filtro } : {})
      .then((d) => {
        if (activo) setPedidos(d.pedidos);
      })
      .catch((err) => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [filtro]);

  const abrirDetalle = async (id) => {
    if (detalleId === id) {
      setDetalleId(null);
      setDetalle(null);
      return;
    }
    setDetalleId(id);
    setDetalle(null);
    try {
      const d = await graphqlRequest(QUERIES.pedidoDetalleAdmin, { id: String(id) });
      setDetalle(d.pedido);
    } catch (err) {
      setDetalle({ error: err.message });
    }
  };

  const cerrarDrawer = () => {
    setDetalleId(null);
    setDetalle(null);
  };

  const cambiarEstado = async (id, nuevo) => {
    if (procesando) return;
    setProcesando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.actualizarEstadoPedido, {
        id: String(id),
        estado: nuevo,
      });
      await cargarPedidos(filtro);
      if (detalleId === id) {
        const d = await graphqlRequest(QUERIES.pedidoDetalleAdmin, { id: String(id) });
        setDetalle(d.pedido);
      }
    } catch (err) {
      setError(`No se pudo actualizar el estado: ${err.message}`);
      setDetalleId(null);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <Esqueleto />;

  return (
    <div>
      {error && <p className="panel-error">{error}</p>}

      <div className="pills">
        {FILTROS.map(([valor, etiqueta]) => (
          <button
            key={valor || 'todos'}
            type="button"
            className={`pill${filtro === valor ? ' pill--activo' : ''}`}
            onClick={() => setFiltro(valor)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <p className="panel-vacio" style={{ marginTop: '16px' }}>No hay órdenes que coincidan.</p>
      ) : (
        <table className="tabla tabla--clickeable" style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Cobro</th>
              <th>Envío</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} onClick={() => abrirDetalle(p.id)}>
                <td style={{ fontWeight: 700 }}>#{p.id}</td>
                <td>
                  {new Date(p.fecha).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td style={{ maxWidth: '180px' }}>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      verticalAlign: 'middle',
                    }}
                  >
                    {p.usuario?.nombre || p.usuario?.email || '—'}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{formatoMoneda(p.total)}</td>
                <td>
                  <span className={`badge badge--${tonoCobro(p.estadoPago)}`}>
                    {estadoCobroEs(p.estadoPago)}
                  </span>
                </td>
                <td>
                  <span className={`badge badge--${tonoEnvio(p.status)}`}>
                    {estadoEnvioEs(p.status)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <IconoFlecha size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {detalleId && (
        <>
          <div className="drawer-backdrop" onClick={cerrarDrawer} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Detalle de la orden">
            <div className="drawer__cabecera">
              <h2>Pedido #{detalleId}</h2>
              <button
                type="button"
                className="drawer__boton-x"
                onClick={cerrarDrawer}
                aria-label="Cerrar"
              >
                <IconoCerrar size={20} />
              </button>
            </div>

            <div className="drawer__contenido">
              {!detalle ? (
                <div className="skeleton">
                  <div className="skeleton__fila" />
                  <div className="skeleton__fila" />
                </div>
              ) : detalle.error ? (
                <p className="panel-error">{detalle.error}</p>
              ) : (
                <DetalleOrden
                  detalle={detalle}
                  procesando={procesando}
                  onCambiarEstado={cambiarEstado}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DetalleOrden({ detalle, procesando, onCambiarEstado }) {
  const opciones = TRANSICIONES[detalle.status] || [];
  const fecha = detalle.fecha ? new Date(detalle.fecha).toLocaleString('es-MX') : '—';

  return (
    <div className="detalle-orden">
      <dl className="detalle-orden__meta">
        <div>
          <dt>Fecha</dt>
          <dd>{fecha}</dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{detalle.usuario?.nombre || detalle.usuario?.email || '—'}</dd>
        </div>
        <div>
          <dt>Método de pago</dt>
          <dd>{detalle.metodoPago ? detalle.metodoPago.replace('_', ' ') : '—'}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd style={{ fontWeight: 700 }}>{formatoMoneda(detalle.total)}</dd>
        </div>
      </dl>

      <div className="detalle-orden__estados">
        <span className={`badge badge--${tonoCobro(detalle.estadoPago)}`}>
          Cobro: {estadoCobroEs(detalle.estadoPago)}
        </span>
        <span className={`badge badge--${tonoEnvio(detalle.status)}`}>
          Envío: {estadoEnvioEs(detalle.status)}
        </span>
      </div>

      <h3>Artículos</h3>
      <ul className="detalle-items">
        {detalle.detalles.map((r, i) => (
          <li key={i} className="detalle-item">
            <span>
              {r.producto?.nombre} × {r.cantidad}
            </span>
            <strong>{formatoMoneda(r.subtotal)}</strong>
          </li>
        ))}
      </ul>

      <p className="detalle-orden__refs">
        Referencia: {detalle.referenciaPago || '—'} · ID de pago: {detalle.idPago || '—'} · Pago.{' '}
        {detalle.fechaPago ? new Date(detalle.fechaPago).toLocaleString('es-MX') : '—'}
      </p>

      <div className="detalle-orden__cambio">
        <h3>Estado de envío</h3>
        {opciones.length === 0 ? (
          <p className="detalle-orden__sin-cambios">
            {detalle.status === 'DELIVERED'
              ? 'El envío ya fue entregado.'
              : 'Este pedido ya no permite cambios de estado.'}
          </p>
        ) : (
          <div className="form-grid-2" style={{ alignItems: 'end' }}>
            <label className="campo">
              <span>Actual</span>
              <input value={estadoEnvioEs(detalle.status)} disabled />
            </label>
            <label className="campo">
              <span>Cambiar a</span>
              <select
                className="select-estado"
                defaultValue=""
                onChange={(e) => onCambiarEstado(detalle.id, e.target.value)}
                disabled={procesando}
              >
                <option value="" disabled>
                  Elegir…
                </option>
                {opciones.map((op) => (
                  <option key={op} value={op}>
                    {estadoEnvioEs(op)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <style>{`
        .detalle-orden { display: flex; flex-direction: column; gap: 16px; }
        .detalle-orden__meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 0;
        }
        .detalle-orden__meta > div {
          background: var(--surface-2);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .detalle-orden__meta dt { font-size: 12px; color: var(--text-muted); }
        .detalle-orden__meta dd { margin: 2px 0 0; font-size: 14px; overflow-wrap: anywhere; }
        .detalle-orden__estados { display: flex; gap: 8px; flex-wrap: wrap; }
        .detalle-orden h3 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
        .detalle-items { list-style: none; padding: 0; margin: 0; }
        .detalle-item {
          display: flex; justify-content: space-between; gap: 8px;
          padding: 10px 0; border-bottom: 1px solid var(--border);
          font-size: 14px;
        }
        .detalle-orden__refs { font-size: 12px; color: var(--text-muted); margin: 0; }
        .detalle-orden__sin-cambios { color: var(--text-muted); font-size: 14px; margin: 0; }
        .select-estado { height: 44px; }
      `}</style>
    </div>
  );
}