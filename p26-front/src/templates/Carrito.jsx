import { useState } from 'react';
import { useCarrito } from '../context/CarritoContext';

/**
 * Carrito — version simple.
 *
 * Alcance de esta entrega: Home -> Categoria -> Producto es lo que se
 * construyo a detalle. Carrito y Checkout quedan funcionales pero
 * minimos: listan lo que ya guarda CarritoContext y avanzan el flujo.
 * Pendiente para completar el equipo: edicion de cantidades por renglon,
 * confirmacion antes de quitar un producto, y estados de carga/error mas
 * ricos si se agregan mas consultas aqui.
 */

function CarritoItem({ item, actualizarCantidad, quitarDelCarrito }) {
  const stock = item.producto.stock ?? 0;
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li className="carrito-item" key={item.producto.id}>
      <span className="carrito-item__nombre">{item.producto.nombre}</span>

      <div className="selector-cantidad selector-cantidad--carrito">
        <span className="visually-hidden">Cantidad</span>
        <button
          className="selector-cantidad__boton"
          onClick={() => actualizarCantidad(item.producto.id, item.cantidad - 1)}
          aria-label="Disminuir cantidad"
          disabled={item.cantidad <= 1}
        >
          −
        </button>
        <span className="selector-cantidad__valor">{item.cantidad}</span>
        <button
          className="selector-cantidad__boton"
          onClick={() => actualizarCantidad(item.producto.id, item.cantidad + 1)}
          aria-label="Aumentar cantidad"
          disabled={item.cantidad >= stock}
        >
          +
        </button>
        {stock > 0 && (
          <span className="carrito-item__stock" style={{ fontSize: 12, color: 'var(--texto-secundario)', marginLeft: 8 }}>
            {item.cantidad} de {stock}
          </span>
        )}
      </div>

      <span className="carrito-item__subtotal">
        ${(item.producto.precio * item.cantidad).toFixed(2)}
      </span>

      {!confirmando ? (
        <button
          className="boton boton--texto"
          onClick={() => setConfirmando(true)}
        >
          Quitar
        </button>
      ) : (
        <span className="carrito-item__confirmacion">
          <span className="carrito-item__confirmacion-texto">¿Quitar?</span>
          <button className="boton boton--texto" onClick={() => { quitarDelCarrito(item.producto.id); setConfirmando(false); }}>
            Sí
          </button>
          <button className="boton boton--texto" onClick={() => setConfirmando(false)}>
            No
          </button>
        </span>
      )}
    </li>
  );
}

export function Carrito({ onVolver, onFinalizarCompra }) {
  const { items, quitarDelCarrito, actualizarCantidad, totalPrecio } = useCarrito();

  if (items.length === 0) {
    return (
      <div className="contenedor pagina">
        <button className="boton boton--texto" onClick={onVolver}>
          ← Seguir comprando
        </button>
        <p className="estado-vacio">Tu carrito esta vacio.</p>
      </div>
    );
  }

  return (
    <div className="contenedor pagina">
      <button className="boton boton--texto" onClick={onVolver}>
        ← Seguir comprando
      </button>

      <h1 className="pagina__titulo">Tu carrito</h1>

      <ul className="carrito-lista">
        {items.map((item) => (
          <CarritoItem
            key={item.producto.id}
            item={item}
            actualizarCantidad={actualizarCantidad}
            quitarDelCarrito={quitarDelCarrito}
          />
        ))}
      </ul>

      <div className="carrito-total">
        <span>Total</span>
        <strong>${totalPrecio.toFixed(2)}</strong>
      </div>

      <button className="boton boton--primario" onClick={onFinalizarCompra}>
        Finalizar compra
      </button>
    </div>
  );
}
