import { useState } from 'react';
import { agregarAlCarrito } from '../stores/carrito.js';
import CantidadSelector from './CantidadSelector.jsx';

/**
 * Botón "Agregar al carrito" de las cards de producto. Un clic agrega 1
 * unidad; no navega. Con stock 0 se muestra "Agotado" deshabilitado y al
 * agregar da un feedback de "✓ Agregado" durante 1.5s.
 *
 * Con `conCantidad` (página de detalle) se antepone un selector "- N +" a la
 * izquierda del botón (con margen de 25px) para elegir la cantidad exacta,
 * limitada entre 1 y el stock disponible. En las cards se mantiene el botón
 * simple de toda la vida.
 */
export default function BotonAgregar({ producto, conCantidad = false }) {
  const stock = Number(producto.stock) || 0;
  const [agregado, setAgregado] = useState(false);
  const [cantidad, setCantidad] = useState(1);

  const handleAgregar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    agregarAlCarrito(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };

  const boton = (
    <button
      type="button"
      className="boton boton--primario producto-card__boton"
      onClick={handleAgregar}
      disabled={stock === 0 || agregado}
      aria-label={stock === 0 ? `${producto.nombre}: agotado` : `Agregar ${producto.nombre} al carrito`}
    >
      {stock === 0 ? 'Agotado' : agregado ? '✓ Agregado' : 'Agregar al carrito'}
    </button>
  );

  return (
    <div
      className={`producto-card__comprar${
        conCantidad ? ' producto-card__comprar--con-cantidad' : ''
      }`}
    >
      {conCantidad && (
        <CantidadSelector
          cantidad={cantidad}
          onCambio={setCantidad}
          stock={stock}
          disabled={stock === 0}
        />
      )}
      {boton}

      <style>{`
        .producto-card__comprar {
          display: flex;
          align-items: center;
        }
        .producto-card__comprar--con-cantidad {
          gap: 25px;
          margin-top: 16px;
        }
        .producto-card__boton {
          width: 100%;
          height: 40px;
          margin-top: 16px;
          font-size: 14px;
          font-weight: 600;
        }
        .producto-card__comprar--con-cantidad .producto-card__boton {
          margin-top: 0;
          flex: 1;
          min-width: 0;
        }
        .producto-card__boton:disabled {
          background: color-mix(in srgb, var(--primary) 55%, var(--surface));
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}