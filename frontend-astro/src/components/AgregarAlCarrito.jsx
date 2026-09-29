import { useState } from 'react';
import { agregarAlCarrito } from '../stores/carrito.js';

// Unica parte interactiva de la pagina de producto (que, por lo demas, es
// una pagina .astro renderizada en el servidor). Recibe el producto ya
// resuelto por el servidor via props (serializadas a JSON por Astro).
export default function AgregarAlCarrito({ producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  const handleAgregar = () => {
    agregarAlCarrito(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };

  return (
    <div className="agregar-carrito">
      <input
        type="number"
        min="1"
        max={producto.stock}
        value={cantidad}
        onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
        className="agregar-carrito__cantidad"
        aria-label="Cantidad"
      />
      <button
        className="boton boton--primario"
        onClick={handleAgregar}
        disabled={producto.stock === 0}
      >
        {producto.stock === 0 ? 'Sin stock' : agregado ? '¡Agregado!' : 'Agregar al carrito'}
      </button>
      <style>{`
        .agregar-carrito { display: flex; gap: 10px; align-items: center; margin-top: 16px; }
        .agregar-carrito__cantidad { width: 64px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
      `}</style>
    </div>
  );
}
