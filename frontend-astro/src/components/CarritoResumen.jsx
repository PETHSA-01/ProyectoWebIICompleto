import { useStore } from '@nanostores/react';
import { $carrito } from '../stores/carrito.js';

// Isla pequena en el encabezado: solo muestra cuantos renglones hay en el
// carrito y enlaza a /carrito. Se re-renderiza sola cuando $carrito cambia
// desde CUALQUIER otra isla (por ejemplo, el boton "Agregar" en la pagina
// de producto), sin que las paginas .astro sepan nada de esto.
export default function CarritoResumen() {
  const carrito = useStore($carrito);
  const totalItems = carrito.reduce((acc, r) => acc + r.cantidad, 0);

  return (
    <a href="/carrito" className="carrito-resumen">
      🛒 Carrito
      {totalItems > 0 && <span className="carrito-resumen__badge">{totalItems}</span>}
      <style>{`
        .carrito-resumen {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: var(--texto);
          font-weight: 600;
          font-size: 14px;
        }
        .carrito-resumen__badge {
          background: var(--violeta);
          color: white;
          border-radius: 999px;
          font-size: 11px;
          padding: 1px 7px;
        }
      `}</style>
    </a>
  );
}
