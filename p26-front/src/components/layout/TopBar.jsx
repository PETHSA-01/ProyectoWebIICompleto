import { useCarrito } from '../../context/CarritoContext';

/**
 * TopBar: vive fuera de los templates del flujo para que el contador del
 * carrito (leido via Context, tema 6/11) se mantenga visible sin importar
 * en que estado de la maquina este la app.
 */
export function TopBar({ busqueda, onCambiarBusqueda, onIrAlCarrito, onVolverHome }) {
  const { totalItems } = useCarrito();

  return (
    <header className="topbar">
      <div className="contenedor topbar__contenido">
        <button className="topbar__logo" onClick={onVolverHome} aria-label="Ir al inicio">
          <span className="topbar__logo-simbolo" aria-hidden="true" />
          NexoPlay
        </button>

        <label className="topbar__buscador">
          <span className="visually-hidden">Buscar productos</span>
          <input
            type="search"
            placeholder="Buscar consolas, accesorios, videojuegos..."
            value={busqueda}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
          />
        </label>

        <button className="topbar__carrito" onClick={onIrAlCarrito} aria-label="Ver carrito">
          <span aria-hidden="true">🛒</span>
          <span className="topbar__carrito-contador">{totalItems}</span>
        </button>
      </div>
    </header>
  );
}
