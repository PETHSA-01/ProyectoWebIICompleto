import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  formatoFechaHora,
  formatoMoneda,
  tipoMovimientoEs,
  tonoMovimiento,
} from '../lib/formatos.js';
import { Drawer, Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';

/**
 * Inventario y almacén: existencias reales, umbral por producto, valor del
 * inventario y el libro de movimientos (entradas, salidas y ajustes).
 * El stock NO se edita a mano: se ajusta con un motivo, para que el libro
 * de inventario explique cada diferencia.
 */
export default function AdminInventario() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [soloBajo, setSoloBajo] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);
  const [drawer, setDrawer] = useState(null); // { tipo: 'ajuste' | 'umbral', producto }
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const data = await graphqlRequest(QUERIES.inventarioAdmin);
      setDatos(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const productos = useMemo(() => {
    const lista = datos?.productos || [];
    const texto = buscar.trim().toLowerCase();
    return lista.filter((p) => {
      if (!verInactivos && p.activo === false) return false;
      if (soloBajo && !p.bajoMinimo) return false;
      if (!texto) return true;
      return (
        p.nombre.toLowerCase().includes(texto) ||
        String(p.sku || '').toLowerCase().includes(texto)
      );
    });
  }, [datos, buscar, soloBajo, verInactivos]);

  const resumen = useMemo(() => {
    const activos = (datos?.productos || []).filter((p) => p.activo !== false);
    return {
      total: activos.length,
      bajo: activos.filter((p) => p.bajoMinimo).length,
      valorCosto: activos.reduce((s, p) => s + p.stock * p.costoAdquisicion, 0),
      valorVenta: activos.reduce((s, p) => s + p.stock * p.precio, 0),
    };
  }, [datos]);

  const cerrarDrawer = () => {
    setDrawer(null);
    setErrorDrawer(null);
  };

  const ejecutar = async (mutation, variables, mensajeError) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      await graphqlRequest(mutation, variables);
      cerrarDrawer();
      await cargar();
    } catch (err) {
      setErrorDrawer(mensajeError ? `${mensajeError} ${err.message}` : err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={5} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Inventario</h1>
          <p className="panel-pagina__sub">
            Existencias por producto, umbral de alerta y libro de movimientos.
          </p>
        </div>
        <div className="panel-acciones">
          <input
            className="buscador"
            type="search"
            placeholder="Buscar producto o SKU…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi etiqueta="Productos activos" valor={resumen.total} />
        <Kpi
          etiqueta="Bajo mínimo"
          valor={resumen.bajo}
          tono={resumen.bajo > 0 ? 'alerta' : 'ok'}
          detalle="Con stock ≤ su umbral"
        />
        <Kpi etiqueta="Valor a costo" valor={formatoMoneda(resumen.valorCosto)} />
        <Kpi
          etiqueta="Valor a precio"
          valor={formatoMoneda(resumen.valorVenta)}
          detalle="Potencial de venta del stock"
        />
      </div>

      <div className="panel-filtros">
        <label className="check">
          <input
            type="checkbox"
            checked={soloBajo}
            onChange={(e) => setSoloBajo(e.target.checked)}
          />
          Solo bajo mínimo
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
          />
          Incluir inactivos
        </label>
        <span className="panel-filtros__conteo">{productos.length} producto(s)</span>
      </div>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th className="num">Stock</th>
              <th className="num">Mínimo</th>
              <th className="num">Costo</th>
              <th className="num">Margen</th>
              <th>Estado</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className={p.activo === false ? 'fila--apagada' : ''}>
                <td>
                  <strong>{p.nombre}</strong>
                  <small className="celda-sub">{p.categoria?.nombre || 'Sin categoría'}</small>
                </td>
                <td>{p.sku || '—'}</td>
                <td className="num">
                  <strong>{p.stock}</strong>
                </td>
                <td className="num">{p.stockMinimo}</td>
                <td className="num">{formatoMoneda(p.costoAdquisicion)}</td>
                <td className="num">{p.margen.toFixed(1)}%</td>
                <td>
                  {p.activo === false ? (
                    <span className="badge badge--neutral">Inactivo</span>
                  ) : p.bajoMinimo ? (
                    <span className="badge badge--bad">Bajo mínimo</span>
                  ) : (
                    <span className="badge badge--ok">Disponible</span>
                  )}
                </td>
                <td className="acciones">
                  <button
                    type="button"
                    className="boton-mini"
                    onClick={() => setDrawer({ tipo: 'ajuste', producto: p })}
                  >
                    Ajustar stock
                  </button>
                  <button
                    type="button"
                    className="boton-mini boton-mini--secundario"
                    onClick={() => setDrawer({ tipo: 'umbral', producto: p })}
                  >
                    Umbral
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productos.length === 0 && (
          <p className="panel-vacio">No hay productos que coincidan con el filtro.</p>
        )}
      </div>

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Libro de inventario</h2>
          <small className="celda-sub">Los movimientos no se editan ni se borran.</small>
        </div>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th className="num">Cantidad</th>
                <th>Origen</th>
                <th>Motivo</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {(datos?.movimientosInventario || []).map((m) => (
                <tr key={m.id}>
                  <td>{formatoFechaHora(m.fecha)}</td>
                  <td>{m.producto?.nombre}</td>
                  <td>
                    <span className={`badge badge--${tonoMovimiento(m.tipo)}`}>
                      {tipoMovimientoEs(m.tipo)}
                    </span>
                  </td>
                  <td className="num">
                    <span className={m.cantidad < 0 ? 'num--negativo' : 'num--positivo'}>
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </span>
                  </td>
                  <td>{origenEs(m.origen)}</td>
                  <td>{m.motivo || '—'}</td>
                  <td>{m.usuario?.nombre || 'Sistema'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(datos?.movimientosInventario || []).length === 0 && (
            <p className="panel-vacio">Todavía no hay movimientos de inventario.</p>
          )}
        </div>
      </section>

      {drawer?.tipo === 'ajuste' && (
        <FormAjuste
          producto={drawer.producto}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrarDrawer}
          onGuardar={(cantidad, motivo) =>
            ejecutar(MUTATIONS.ajustarStock, {
              productoId: drawer.producto.id,
              cantidad,
              motivo,
            })
          }
        />
      )}

      {drawer?.tipo === 'umbral' && (
        <FormUmbral
          producto={drawer.producto}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrarDrawer}
          onGuardar={(stockMinimo) =>
            ejecutar(MUTATIONS.actualizarUmbralStock, {
              productoId: drawer.producto.id,
              stockMinimo,
            })
          }
        />
      )}
    </div>
  );
}

function origenEs(origen) {
  return (
    {
      OC: 'Orden de compra',
      PEDIDO: 'Venta',
      AJUSTE_MANUAL: 'Ajuste manual',
      CANCELACION: 'Cancelación',
    }[origen] || origen
  );
}

function FormAjuste({ producto, onCerrar, onGuardar, guardando, error }) {
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('');
  const delta = Number(cantidad) || 0;
  const nuevoStock = Number(producto.stock) + delta;

  return (
    <Drawer
      titulo="Ajustar stock"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={guardando || !motivo.trim() || delta === 0}
            onClick={() => onGuardar(delta, motivo.trim())}
          >
            {guardando ? 'Guardando…' : 'Registrar ajuste'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <p>
          <strong>{producto.nombre}</strong>
          <br />
          <small className="celda-sub">
            Stock actual: {producto.stock} · Umbral: {producto.stockMinimo}
          </small>
        </p>

        <Nota>
          Un ajuste es para corregir diferencias (merma, robo, conteo físico). Positivo
          suma al stock; negativo resta.
        </Nota>

        <label className="campo">
          Cantidad
          <input
            type="number"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </label>

        <div className="botones-cantidad">
          <button type="button" className="boton-mini" onClick={() => setCantidad('1')}>
            +1
          </button>
          <button type="button" className="boton-mini" onClick={() => setCantidad('-1')}>
            -1
          </button>
        </div>

        <p className="panel-filtros__conteo">
          Stock resultante: <strong className={nuevoStock < 0 ? 'num--negativo' : ''}>{nuevoStock}</strong>
        </p>

        <label className="campo">
          Motivo (obligatorio)
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. merma por empaque dañado, conteo físico de octubre…"
          />
        </label>

        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}

function FormUmbral({ producto, onCerrar, onGuardar, guardando, error }) {
  const [umbral, setUmbral] = useState(String(producto.stockMinimo));
  return (
    <Drawer
      titulo="Umbral de alerta"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={guardando}
            onClick={() => onGuardar(Number(umbral))}
          >
            {guardando ? 'Guardando…' : 'Guardar umbral'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <p>
          <strong>{producto.nombre}</strong>
          <br />
          <small className="celda-sub">Stock actual: {producto.stock}</small>
        </p>
        <label className="campo">
          Se alerta cuando el stock sea menor o igual a
          <input
            type="number"
            min="0"
            step="1"
            value={umbral}
            onChange={(e) => setUmbral(e.target.value)}
          />
        </label>
        <Nota>El umbral es por producto: no todos los artículos rotan igual.</Nota>
        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}
