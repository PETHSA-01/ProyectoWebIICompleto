import { useCarrito } from '../../context/CarritoContext';

/**
 * Zona de "context" del layout: mensaje de promocion, o un vistazo rapido
 * del carrito cuando ya tiene productos. Tema 6/11: lee el mismo Context
 * que el TopBar sin recibir nada por props.
 */
export function ContextBar({ onIrAlCarrito }) {
  const { totalItems, totalPrecio } = useCarrito();

  if (totalItems === 0) {
    return (
      <aside className="context-bar context-bar--promo">
        Envios rastreables a todo el pais. Los productos con stock bajo se
        marcan en el catalogo para que no te quedes sin el tuyo.
      </aside>
    );
  }

  return (
    <aside className="context-bar context-bar--carrito">
      <span>
        Llevas <strong>{totalItems}</strong> {totalItems === 1 ? 'producto' : 'productos'} — $
        {totalPrecio.toFixed(2)}
      </span>
      <button className="boton boton--texto" onClick={onIrAlCarrito}>
        Ver carrito
      </button>
    </aside>
  );
}
