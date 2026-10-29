// Piezas compartidas por las islas del panel (esqueleto, error, KPI, drawer).
// Mantener el mismo look & feel de AdminDash/AdminProductos.
import { IconoCerrar } from './Iconos.jsx';

export function Esqueleto({ filas = 4 }) {
  return (
    <div className="skeleton">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="skeleton__fila" />
      ))}
    </div>
  );
}

export function PanelError({ mensaje }) {
  if (!mensaje) return null;
  return <p className="panel-error">{mensaje}</p>;
}

export function Kpi({ etiqueta, valor, detalle, tono }) {
  return (
    <div className={`kpi-card${tono ? ` kpi-card--${tono}` : ''}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {detalle && <small className="kpi-card__detalle">{detalle}</small>}
    </div>
  );
}

export function Drawer({ titulo, onCerrar, children, pie, ancho = 520 }) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onCerrar} />
      <aside className="drawer" style={{ width: ancho }} role="dialog" aria-modal="true">
        <header className="drawer__cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="drawer__boton-x" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </header>
        <div className="drawer__contenido">{children}</div>
        {pie && <footer className="drawer__pie">{pie}</footer>}
      </aside>
    </>
  );
}

export function Nota({ children, tono = 'info' }) {
  return <p className={`nota nota--${tono}`}>{children}</p>;
}

/** Descarga un texto (XML, CSV) como archivo desde el navegador. */
export function descargarArchivo(nombre, contenido, tipo = 'application/xml') {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** "<dl>" de datos clave-valor en dos columnas. */
export function Datos({ filas }) {
  return (
    <dl className="datos-lista">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="datos-lista__fila">
          <dt>{etiqueta}</dt>
          <dd>{valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
