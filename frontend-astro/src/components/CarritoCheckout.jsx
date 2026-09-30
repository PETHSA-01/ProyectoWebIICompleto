import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $carrito, quitarDelCarrito, vaciarCarrito } from '../stores/carrito.js';
import { $sesion } from '../stores/sesion.js';
import { graphqlRequest, MUTATIONS } from '../lib/graphql.js';

// Isla que resuelve tanto el carrito como el checkout de /carrito.astro.
// Requiere sesion (Google) para confirmar el pedido: crearPedido ya no
// recibe usuarioId, lo toma del JWT (ver backend/src/resolvers.js), asi
// que si no hay $sesion no hay forma de mandar la mutacion.
export default function CarritoCheckout() {
  const carrito = useStore($carrito);
  const sesion = useStore($sesion);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const total = carrito.reduce((acc, r) => acc + r.precio * r.cantidad, 0);

  const confirmarPedido = async () => {
    setProcesando(true);
    setError(null);
    try {
      const data = await graphqlRequest(
        MUTATIONS.crearPedido,
        { d: { detalles: carrito.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad })) } },
        sesion.token
      );
      setResultado(data.crearPedido);
      vaciarCarrito();
    } catch (err) {
      // El proxy /api/graphql devuelve 401 cuando el JWT de la cookie ya
      // caduco. Antes ese caso caia en el mismo mensaje de "error de red"
      // que un 500, y el boton de confirmar seguia ahi como si nada.
      setError(
        err.status === 401
          ? 'Tu sesion expiro. Sal y vuelve a entrar con Google para confirmar el pedido.'
          : err.message
      );
    } finally {
      setProcesando(false);
    }
  };

  if (resultado) {
    return (
      <div className="checkout-ok">
        <h2>¡Pedido confirmado!</h2>
        <p>
          Pedido #{resultado.id} — Total: ${Number(resultado.total).toFixed(2)} MXN
        </p>
        <ul>
          {resultado.detalles.map((d, i) => (
            <li key={i}>
              {d.cantidad}x {d.producto.nombre} — ${Number(d.subtotal).toFixed(2)}
            </li>
          ))}
        </ul>
        <a href="/" className="boton boton--primario">
          Seguir comprando
        </a>
      </div>
    );
  }

  if (carrito.length === 0) {
    return (
      <div className="carrito-vacio">
        <p>Tu carrito esta vacio.</p>
        <a href="/" className="boton boton--secundario">
          Ver catalogo
        </a>
      </div>
    );
  }

  return (
    <div className="carrito">
      <ul className="carrito__lista">
        {carrito.map((r) => (
          <li key={r.productoId} className="carrito__renglon">
            <span className="carrito__nombre">
              {r.nombre} <small>x{r.cantidad}</small>
            </span>
            <span>${(r.precio * r.cantidad).toFixed(2)}</span>
            <button
              className="boton boton--texto boton--peligro"
              onClick={() => quitarDelCarrito(r.productoId)}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <div className="carrito__total">
        <strong>Total: ${total.toFixed(2)} MXN</strong>
      </div>

      {!sesion ? (
        <p className="carrito__aviso">
          Inicia sesion con Google (arriba, en el encabezado) para confirmar tu pedido.
        </p>
      ) : (
        <button
          className="boton boton--primario"
          onClick={confirmarPedido}
          disabled={procesando}
        >
          {procesando ? 'Procesando...' : 'Confirmar pedido'}
        </button>
      )}

      {error && <p className="carrito__error">{error}</p>}

      <style>{`
        .carrito__lista { list-style: none; padding: 0; margin: 0 0 20px; }
        .carrito__renglon {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
        }
        .carrito__nombre small { color: var(--texto-secundario); }
        .carrito__total { font-size: 18px; margin-bottom: 16px; }
        .carrito__aviso { color: var(--texto-secundario); font-size: 14px; }
        .carrito__error { color: var(--error); margin-top: 10px; }
        .carrito-vacio, .checkout-ok { text-align: center; padding: 40px 0; }
      `}</style>
    </div>
  );
}
