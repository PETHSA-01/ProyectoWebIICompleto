import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoOCEs,
  formatoFecha,
  formatoMoneda,
  tonoOC,
} from '../lib/formatos.js';
import { Drawer, Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';
import { IconoMas } from './Iconos.jsx';

const TASA = 0.16;
const FILTROS = [
  ['', 'Todas'],
  ['BORRADOR', 'Borradores'],
  ['RECIBIDA', 'Recibidas'],
  ['CANCELADA', 'Canceladas'],
];

/**
 * Compras: órdenes de compra a proveedores. Una OC nace en BORRADOR; al
 * recibirla entra stock, se actualiza el costo de adquisición y se generan
 * los asientos contables (BANCO/INVENTARIO/IVA acreditable).
 */
export default function AdminCompras() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [drawer, setDrawer] = useState(null); // {tipo:'nueva'} | {tipo:'detalle', oc}
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.comprasAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ordenes = useMemo(() => {
    const lista = datos?.ordenesCompra || [];
    return filtro ? lista.filter((o) => o.estado === filtro) : lista;
  }, [datos, filtro]);

  const resumen = useMemo(() => {
    const lista = datos?.ordenesCompra || [];
    const recibidas = lista.filter((o) => o.estado === 'RECIBIDA');
    return {
      borradores: lista.filter((o) => o.estado === 'BORRADOR').length,
      recibidas: recibidas.length,
      comprado: recibidas.reduce((s, o) => s + o.total, 0),
      proveedores: (datos?.proveedores || []).filter((p) => p.activo).length,
    };
  }, [datos]);

  const cerrar = () => {
    setDrawer(null);
    setErrorDrawer(null);
    setConfirmar(null);
  };

  const accion = async (mutation, variables) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      await graphqlRequest(mutation, variables);
      setConfirmar(null);
      await cargar();
      return true;
    } catch (err) {
      setErrorDrawer(err.message);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={5} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Compras</h1>
          <p className="panel-pagina__sub">
            Órdenes de compra a proveedores y entradas al inventario.
          </p>
        </div>
        <button
          type="button"
          className="boton boton--primario"
          onClick={() => setDrawer({ tipo: 'nueva' })}
          disabled={(datos?.proveedores || []).length === 0}
        >
          <IconoMas /> Nueva orden
        </button>
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi etiqueta="Borradores" valor={resumen.borradores} tono={resumen.borradores ? 'alerta' : undefined} />
        <Kpi etiqueta="Órdenes recibidas" valor={resumen.recibidas} />
        <Kpi etiqueta="Comprado (recibido)" valor={formatoMoneda(resumen.comprado)} />
        <Kpi etiqueta="Proveedores activos" valor={resumen.proveedores} />
      </div>

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
              <th>OC</th>
              <th>Proveedor</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th className="num">Renglones</th>
              <th className="num">Subtotal</th>
              <th className="num">IVA</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id} onClick={() => setDrawer({ tipo: 'detalle', oc: o })}>
                <td>#{o.id}</td>
                <td>{o.proveedor?.nombre}</td>
                <td>{formatoFecha(o.fecha)}</td>
                <td>
                  <span className={`badge badge--${tonoOC(o.estado)}`}>
                    {estadoOCEs(o.estado)}
                  </span>
                </td>
                <td className="num">{o.detalles.length}</td>
                <td className="num">{formatoMoneda(o.subtotal)}</td>
                <td className="num">{formatoMoneda(o.impuestos)}</td>
                <td className="num">
                  <strong>{formatoMoneda(o.total)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordenes.length === 0 && (
          <p className="panel-vacio">No hay órdenes de compra en este filtro.</p>
        )}
      </div>

      {drawer?.tipo === 'nueva' && (
        <FormNuevaOC
          proveedores={datos.proveedores.filter((p) => p.activo)}
          productos={datos.productos}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrar}
          onGuardar={async (proveedorId, renglones) => {
            const ok = await accion(MUTATIONS.crearOrdenCompra, { proveedorId, renglones });
            if (ok) {
              setDrawer(null);
              setFiltro('BORRADOR');
            }
          }}
        />
      )}

      {drawer?.tipo === 'detalle' && (
        <DetalleOC
          oc={drawer.oc}
          guardando={guardando}
          error={errorDrawer}
          confirmar={confirmar}
          onConfirmar={setConfirmar}
          onCerrar={cerrar}
          onRecibir={() => accion(MUTATIONS.recibirOrdenCompra, { id: drawer.oc.id })}
          onCancelar={() => accion(MUTATIONS.cancelarOrdenCompra, { id: drawer.oc.id })}
        />
      )}
    </div>
  );
}

function FormNuevaOC({ proveedores, productos, onCerrar, onGuardar, guardando, error }) {
  const [proveedorId, setProveedorId] = useState('');
  const [renglones, setRenglones] = useState([
    { productoId: '', cantidad: '1', costoUnitario: '' },
  ]);
  const [errorLocal, setErrorLocal] = useState(null);

  const actualizar = (indice, campo, valor) => {
    setRenglones((actuales) =>
      actuales.map((r, i) => {
        if (i !== indice) return r;
        if (campo === 'productoId') {
          const producto = productos.find((p) => String(p.id) === String(valor));
          return {
            ...r,
            productoId: valor,
            costoUnitario:
              r.costoUnitario === '' && producto ? String(producto.costoAdquisicion) : r.costoUnitario,
          };
        }
        return { ...r, [campo]: valor };
      })
    );
  };

  const subtotal = renglones.reduce(
    (s, r) => s + (Number(r.cantidad) || 0) * (Number(r.costoUnitario) || 0),
    0
  );
  const impuestos = Math.round(subtotal * TASA * 100) / 100;
  const total = subtotal + impuestos;

  const enviar = () => {
    setErrorLocal(null);
    if (!proveedorId) return setErrorLocal('Elige un proveedor.');
    if (renglones.some((r) => !r.productoId)) return setErrorLocal('Cada renglón necesita un producto.');
    if (renglones.some((r) => !(Number(r.cantidad) > 0))) {
      return setErrorLocal('Cada renglón necesita una cantidad mayor a cero.');
    }
    onGuardar(
      proveedorId,
      renglones.map((r) => ({
        productoId: r.productoId,
        cantidad: Number(r.cantidad),
        costoUnitario: Number(r.costoUnitario) || 0,
      }))
    );
  };

  return (
    <Drawer
      titulo="Nueva orden de compra"
      ancho={680}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="boton boton--primario" disabled={guardando} onClick={enviar}>
            {guardando ? 'Guardando…' : 'Crear borrador'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="campo">
          Proveedor
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">— Elegir proveedor —</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.condicionesPago === 'CONTADO' ? 'contado' : p.condicionesPago.replace('_', ' ')})
              </option>
            ))}
          </select>
        </label>

        <div className="renglones-oc">
          {renglones.map((r, i) => (
            <div className="renglon-oc" key={i}>
              <label className="campo">
                Producto
                <select value={r.productoId} onChange={(e) => actualizar(i, 'productoId', e.target.value)}>
                  <option value="">— Elegir —</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · stock {p.stock}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo campo--corto">
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={r.cantidad}
                  onChange={(e) => actualizar(i, 'cantidad', e.target.value)}
                />
              </label>
              <label className="campo campo--corto">
                Costo unitario
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={r.costoUnitario}
                  onChange={(e) => actualizar(i, 'costoUnitario', e.target.value)}
                />
              </label>
              <button
                type="button"
                className="boton-mini boton-mini--peligro"
                onClick={() => setRenglones((rs) => rs.filter((_, j) => j !== i))}
                disabled={renglones.length === 1}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="boton-mini"
          onClick={() => setRenglones((rs) => [...rs, { productoId: '', cantidad: '1', costoUnitario: '' }])}
        >
          + Agregar renglón
        </button>

        <div className="totales-caja">
          <div>
            <span>Subtotal</span>
            <span>{formatoMoneda(subtotal)}</span>
          </div>
          <div>
            <span>IVA (16%)</span>
            <span>{formatoMoneda(impuestos)}</span>
          </div>
          <div className="totales-caja__total">
            <span>Total</span>
            <strong>{formatoMoneda(total)}</strong>
          </div>
        </div>

        <Nota>
          La orden nace en BORRADOR: no mueve stock ni contabilidad hasta que la
          recibas (ahí entran las unidades y se actualiza el costo).
        </Nota>

        <PanelError mensaje={errorLocal} />
        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}

function DetalleOC({ oc, onCerrar, onRecibir, onCancelar, guardando, error, confirmar, onConfirmar }) {
  return (
    <Drawer
      titulo={`Orden de compra #${oc.id}`}
      ancho={600}
      onCerrar={onCerrar}
      pie={
        oc.estado === 'BORRADOR' ? (
          confirmar ? (
            <>
              <button type="button" className="boton boton--secundario" onClick={() => onConfirmar(null)}>
                Volver
              </button>
              <button
                type="button"
                className="boton boton--primario"
                disabled={guardando}
                onClick={confirmar === 'recibir' ? onRecibir : onCancelar}
              >
                {guardando
                  ? 'Procesando…'
                  : confirmar === 'recibir'
                    ? 'Sí, recibir mercancía'
                    : 'Sí, cancelar orden'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="boton boton--secundario"
                onClick={() => onConfirmar('cancelar')}
              >
                Cancelar orden
              </button>
              <button
                type="button"
                className="boton boton--primario"
                onClick={() => onConfirmar('recibir')}
              >
                Recibir mercancía
              </button>
            </>
          )
        ) : null
      }
    >
      <div className="form-grid">
        <div className="ficha">
          <div>
            <small>Proveedor</small>
            <strong>{oc.proveedor?.nombre}</strong>
          </div>
          <div>
            <small>Estado</small>
            <span className={`badge badge--${tonoOC(oc.estado)}`}>{estadoOCEs(oc.estado)}</span>
          </div>
          <div>
            <small>Fecha</small>
            <strong>{formatoFecha(oc.fecha)}</strong>
          </div>
          <div>
            <small>Recibida</small>
            <strong>{oc.recibidaEn ? formatoFecha(oc.recibidaEn) : '—'}</strong>
          </div>
        </div>

        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Cantidad</th>
                <th className="num">Costo unitario</th>
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {oc.detalles.map((d) => (
                <tr key={d.id}>
                  <td>{d.producto?.nombre}</td>
                  <td className="num">{d.cantidad}</td>
                  <td className="num">{formatoMoneda(d.costoUnitario)}</td>
                  <td className="num">{formatoMoneda(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="totales-caja">
          <div>
            <span>Subtotal</span>
            <span>{formatoMoneda(oc.subtotal)}</span>
          </div>
          <div>
            <span>IVA</span>
            <span>{formatoMoneda(oc.impuestos)}</span>
          </div>
          <div className="totales-caja__total">
            <span>Total</span>
            <strong>{formatoMoneda(oc.total)}</strong>
          </div>
        </div>

        {confirmar && (
          <Nota tono="alerta">
            {confirmar === 'recibir'
              ? 'Al recibir: entra el stock, el costo de adquisición se actualiza y se generan asientos contables. Esta acción no se puede deshacer.'
              : 'La orden quedará CANCELADA y no moverá stock ni contabilidad.'}
          </Nota>
        )}

        {oc.estado === 'RECIBIDA' && (
          <Nota>Esta orden ya entró al inventario y a la contabilidad.</Nota>
        )}

        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}
