import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $carrito, cambiarCantidad, quitarDelCarrito, vaciarCarrito } from '../stores/carrito.js';
import CantidadSelector from './CantidadSelector.jsx';
import PagoMercadoPago from './PagoMercadoPago.jsx';
import PagoOxxo from './PagoOxxo.jsx';
import { $sesion } from '../stores/sesion.js';
import { graphqlRequest, MUTATIONS, QUERIES } from '../lib/graphql.js';
import { formatoMoneda } from '../lib/formatos.js';

/**
 * Isla de la página /carrito y de la reanudación de pago.
 *
 * Flujo normal: se crea el pedido (envío PENDING / cobro PENDIENTE), se
 * elige método (Mercado Pago con tarjeta, OXXO en efectivo o PayPal) y se
 * confirma el cobro en /pago/resultado.
 *
 * Reanudación: al llegar con ?pagar=<id> (desde Mis Órdenes, solo si el
 * cobro sigue PENDIENTE) se consulta el pedido por API —el proxy adjunta la
 * cookie httpOnly y el backend valida que sea del dueño— y se abre directo
 * en "Elige cómo pagar" sin cargar el carrito.
 *
 * Hidratación: $carrito vive en localStorage, así que el servidor siempre lo
 * vería vacío. Con `listo` solo se pinta contenido DESPUÉS de montar la
 * isla, evitando el choque de hidratación (React #418/#423).
 */
export default function CarritoCheckout() {
  const carrito = useStore($carrito);
  const sesion = useStore($sesion);
  const [listo, setListo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState(null);
  const [pagarError, setPagarError] = useState(null);
  // Con Checkout API, Mercado Pago ya no redirige: al elegirlo se muestra el
  // brick de tarjeta en la misma pagina. PayPal conserva la redireccion.
  const [metodoElegido, setMetodoElegido] = useState(null);
  // Guarda contra doble clic: un doble clic no debe crear DOS pedidos (ni
  // dos preferencias de pago).
  const enProceso = useRef(false);

  useEffect(() => {
    setListo(true);

    // Reanudación de un cobro pendiente desde Mis Órdenes.
    const idPendiente = new URLSearchParams(window.location.search).get('pagar');
    if (idPendiente) {
      graphqlRequest(QUERIES.miPedidoPendiente, { id: idPendiente })
        .then((datos) => {
          const p = datos?.pedido;
          if (!p) {
            setError('No se encontró ese pedido.');
            return;
          }
          if (p.estadoPago === 'APROBADO') {
            setError('Ese pedido ya fue pagado. Lo puedes ver en Mis órdenes.');
            return;
          }
          setPedido(p);
          // Un cobro OXXO pendiente ya tiene ficha: se reabre directo en vez
          // de ofrecer de nuevo los métodos (evita emitir un ticket nuevo).
          if (p.metodoPago === 'OXXO' && p.ticketUrl) {
            setMetodoElegido('OXXO');
          }
        })
        .catch((err) => {
          setPagarError(
            err.status === 401
              ? { estado: 401 }
              : { estado: 0, mensaje: err.message }
          );
        });
      return undefined;
    }
    return undefined;
  }, []);

  // Los precios del catálogo son netos: el IVA se agrega y se desglosa.
  // (La tasa viaja por pedido; 16% es la general en México.)
  const TASA_IVA = 0.16;
  const subtotal = carrito.reduce((acc, r) => acc + r.precio * r.cantidad, 0);
  const iva = Math.round(subtotal * TASA_IVA * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  const renglonesInvalidos = carrito.filter(
    (r) => Number(r.stock) > 0 && (r.cantidad || 0) > Number(r.stock)
  );

  const confirmarPedido = async () => {
    if (enProceso.current) return;
    enProceso.current = true;
    setProcesando(true);
    setError(null);
    try {
      if (renglonesInvalidos.length > 0) {
        const primero = renglonesInvalidos[0];
        throw new Error(
          `"${primero.nombre}" solo tiene ${primero.stock} en existencia. Ajusta la cantidad e intenta de nuevo.`
        );
      }
      const data = await graphqlRequest(
        MUTATIONS.crearPedido,
        {
          d: {
            tasaImpuesto: TASA_IVA,
            costoEnvio: 0,
            detalles: carrito.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad })),
          },
        }
        // En el navegador el token no viaja acá: /api/graphql lee la cookie
        // httpOnly y autoriza contra el backend por nosotros.
      );
      setPedido(data.crearPedido);
      vaciarCarrito();
    } catch (err) {
      setError(
        err.status === 401
          ? 'Tu sesión expiró. Vuelve a iniciar sesión y confirma el pedido.'
          : err.message
      );
    } finally {
      enProceso.current = false;
      setProcesando(false);
    }
  };

  const pagarConPayPal = async () => {
    if (enProceso.current) return;
    enProceso.current = true;
    setProcesando(true);
    setPagarError(null);
    try {
      const data = await graphqlRequest(MUTATIONS.iniciarPagoPayPal, {
        pedidoId: String(pedido.id),
      });
      const url = data.iniciarPagoPayPal.url;
      if (!url) throw new Error('PayPal no devolvió una URL de pago.');
      window.location.assign(url);
    } catch (err) {
      setPagarError(`No se pudo iniciar el pago: ${err.message}`);
      enProceso.current = false;
      setProcesando(false);
    }
  };

  // Durante/antes de la hidratación no pintamos contenido para no chocar.
  if (!listo) return null;

  // Error al reanudar pago por sesión perdida.
  if (pagarError?.estado === 401) {
    return (
      <div className="carrito-aviso">
        <p>Tu sesión expiró. Inicia sesión de nuevo para pagar tu pedido.</p>
        <a href="/login" className="boton boton--primario">
          Iniciar sesión
        </a>
        <style>{`
          .carrito-aviso {
            text-align: center;
            padding: 40px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: var(--text);
          }
        `}</style>
      </div>
    );
  }
  // Solo los errores de "reanudar pedido" son objetos ({ estado, mensaje }) y
  // reemplazan la pantalla. Los errores al iniciar un pago (PayPal, tarjeta,
  // OXXO) son texto y se muestran en línea, junto al método de pago.
  if (pagarError && typeof pagarError === 'object') {
    return (
      <div className="carrito-aviso">
        <p className="carrito-aviso__error">No se pudo recuperar el pedido: {pagarError.mensaje}</p>
        <a href="/mis-ordenes" className="boton boton--secundario">
          Volver a mis órdenes
        </a>
        <style>{`
          .carrito-aviso {
            text-align: center;
            padding: 40px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .carrito-aviso__error { color: var(--danger); }
        `}</style>
      </div>
    );
  }

  // --- Paso 2: elegir método de pago (o reanudado con ?pagar=) -------
  if (pedido) {
    return (
      <div className="checkout-metodo">
        <span className="checkout-metodo__eyebrow">Pago pendiente</span>
        <h2>
          {metodoElegido === 'MERCADO_PAGO'
            ? 'Paga con tarjeta'
            : metodoElegido === 'OXXO'
              ? 'Paga en efectivo en OXXO'
              : 'Elige cómo pagar'}
        </h2>

        {metodoElegido === 'MERCADO_PAGO' ? (
          <PagoMercadoPago
            pedidoId={pedido.id}
            total={pedido.total}
            payerEmail={sesion?.email}
            onVolver={() => {
              setPagarError(null);
              setMetodoElegido(null);
            }}
          />
        ) : metodoElegido === 'OXXO' ? (
          <PagoOxxo
            pedidoId={pedido.id}
            total={pedido.total}
            payerEmail={sesion?.email}
            ticket={
              pedido.metodoPago === 'OXXO' && pedido.ticketUrl
                ? { url: pedido.ticketUrl, referencia: pedido.referenciaPago }
                : null
            }
            onVolver={() => {
              setPagarError(null);
              setMetodoElegido(null);
            }}
          />
        ) : (
          <>
            <p className="checkout-metodo__resumen">
              Pedido <strong>#{pedido.id}</strong> · Total{' '}
              <strong>{formatoMoneda(pedido.total)}</strong>
            </p>

            <div className="checkout-metodo__opciones">
              <button
                className="tarjeta-pago"
                onClick={() => {
                  setPagarError(null);
                  setMetodoElegido('MERCADO_PAGO');
                }}
                disabled={procesando}
              >
                <span className="tarjeta-pago__logo tarjeta-pago__logo--mp">MP</span>
                <span className="tarjeta-pago__texto">
                  <strong>Mercado Pago</strong>
                  <span>Tarjeta de crédito o débito sin salir del sitio.</span>
                </span>
                <span className="tarjeta-pago__flecha">→</span>
              </button>
              <button
                className="tarjeta-pago"
                onClick={() => pagarConPayPal()}
                disabled={procesando}
              >
                <span className="tarjeta-pago__logo tarjeta-pago__logo--pp">P</span>
                <span className="tarjeta-pago__texto">
                  <strong>PayPal</strong>
                  <span>Paga con tu cuenta PayPal (sandbox) en pocos clics.</span>
                </span>
                <span className="tarjeta-pago__flecha">→</span>
              </button>
              <button
                className="tarjeta-pago"
                onClick={() => {
                  setPagarError(null);
                  setMetodoElegido('OXXO');
                }}
                disabled={procesando}
              >
                <span className="tarjeta-pago__logo tarjeta-pago__logo--oxxo">OXXO</span>
                <span className="tarjeta-pago__texto">
                  <strong>OXXO</strong>
                  <span>Paga en efectivo en tienda con una ficha.</span>
                </span>
                <span className="tarjeta-pago__flecha">→</span>
              </button>
            </div>

            {pagarError && <p className="checkout-metodo__error">{pagarError}</p>}
            {procesando && <p className="checkout-metodo__aviso">Redirigiendo a PayPal…</p>}

            <a href="/" className="boton boton--texto">
              Volver al catálogo
            </a>
          </>
        )}

        <style>{`
          .checkout-metodo { display: flex; flex-direction: column; gap: 14px; }
          .checkout-metodo__eyebrow {
            font-size: 13px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.06em; color: var(--accent);
          }
          .checkout-metodo h2 { font-size: 28px; font-weight: 700; margin: 0; }
          .checkout-metodo__resumen { margin: 0; font-size: 15px; }
          .checkout-metodo__resumen strong { color: var(--primary); }
          .checkout-metodo__opciones { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
          .tarjeta-pago {
            cursor: pointer; text-align: left; font: inherit;
            background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius-md); padding: 16px;
            display: flex; align-items: center; gap: 12px;
            transition: border-color 0.15s ease;
          }
          .tarjeta-pago:hover:not(:disabled) { border-color: var(--primary); }
          .tarjeta-pago:disabled { opacity: 0.6; cursor: wait; }
          .tarjeta-pago__logo {
            width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
            display: inline-flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 800; color: #fff;
          }
          .tarjeta-pago__logo--mp { background: #00b1ea; }
          .tarjeta-pago__logo--pp { background: #ffc439; color: #003087; }
          .tarjeta-pago__logo--oxxo { background: #e60028; font-size: 11px; letter-spacing: 0.02em; }
          .tarjeta-pago__texto { display: flex; flex-direction: column; gap: 2px; flex: 1; }
          .tarjeta-pago__texto strong { font-size: 15px; }
          .tarjeta-pago__texto span { color: var(--text-muted); font-size: 13px; }
          .tarjeta-pago__flecha { color: var(--text-muted); font-size: 18px; }
          .checkout-metodo__error { color: var(--danger); font-size: 14px; margin: 0; }
          .checkout-metodo__aviso { color: var(--text-muted); font-size: 14px; margin: 0; }
        `}</style>
      </div>
    );
  }

  // --- Sin sesión / carrito vacío / paso 1 (confirmar) ---------------
  if (carrito.length === 0) {
    return (
      <div className="carrito-vacio">
        <p>Tu carrito está vacío.</p>
        <a href="/" className="boton boton--secundario">
          Ver catálogo
        </a>
        <style>{`
          .carrito-vacio { text-align: center; padding: 48px 0; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="checkout">
      <div className="checkout__panel">
        <h2>Tu carrito</h2>
        <ul className="carrito__lista">
          {carrito.map((r) => {
            const invalido = Number(r.stock) > 0 && (r.cantidad || 0) > Number(r.stock);
            return (
              <li
                key={r.productoId}
                className={`carrito__renglon${invalido ? ' carrito__renglon--invalido' : ''}`}
              >
                <div className="carrito__renglon-info">
                  <span className="carrito__nombre">{r.nombre}</span>
                  {invalido && (
                    <small className="carrito__aviso carrito__aviso--alerta">
                      Solo quedan {r.stock}
                    </small>
                  )}
                </div>
                <div className="carrito__renglon-der">
                  <strong>{formatoMoneda(r.precio * r.cantidad)}</strong>
                  <CantidadSelector
                    cantidad={r.cantidad}
                    onCambio={(n) => cambiarCantidad(r.productoId, n)}
                    stock={r.stock}
                  />
                  <button
                    className="boton boton--texto boton--peligro carrito__eliminar-todos"
                    onClick={() => quitarDelCarrito(r.productoId)}
                  >
                    Eliminar todos
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="checkout__resumen">
        <h3>Resumen</h3>
        <div className="checkout__renglon">
          <span>Subtotal</span>
          <span>{formatoMoneda(subtotal)}</span>
        </div>
        <div className="checkout__renglon">
          <span>IVA (16%)</span>
          <span>{formatoMoneda(iva)}</span>
        </div>
        <div className="checkout__renglon">
          <span>Envío</span>
          <span>Gratis</span>
        </div>
        <div className="checkout__renglon checkout__renglon--total">
          <span>Total</span>
          <strong>{formatoMoneda(total)}</strong>
        </div>

        {renglonesInvalidos.length > 0 && (
          <p className="carrito__aviso carrito__aviso--alerta">
            Hay productos que ya exceden su existencia. Ajusta las cantidades antes de continuar.
          </p>
        )}

        {error && <p className="checkout__error">{error}</p>}

        {!sesion ? (
          <p className="carrito__aviso">
            <a href="/login">Inicia sesión</a> para confirmar tu pedido.
          </p>
        ) : (
          <button
            className="boton boton--primario boton--ancho"
            onClick={confirmarPedido}
            disabled={procesando || renglonesInvalidos.length > 0}
          >
            {procesando ? 'Procesando…' : 'Confirmar pedido'}
          </button>
        )}
      </aside>

      <style>
        {`
          .checkout {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 20px;
            align-items: start;
          }
          .checkout__panel, .checkout__resumen {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 20px;
          }
          .checkout__panel h2 { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
          .checkout__resumen h3 { font-size: 18px; font-weight: 700; margin: 0 0 12px; }
          .carrito__lista { list-style: none; padding: 0; margin: 0; }
          .carrito__renglon {
            display: flex; justify-content: space-between; align-items: center;
            gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
          }
          .carrito__renglon:last-child { border-bottom: none; }
          .carrito__renglon--invalido .carrito__nombre { color: var(--danger); }
          .carrito__renglon-info { display: flex; flex-direction: column; gap: 2px; }
          .carrito__nombre { font-size: 15px; font-weight: 600; }
          .carrito__renglon-der { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
          .carrito__renglon-der strong { font-size: 15px; }
          .carrito__eliminar-todos {
            width: 64px;
            text-align: center;
            white-space: normal;
            line-height: 1.2;
            flex-shrink: 0;
          }
          .checkout__renglon {
            display: flex; justify-content: space-between; align-items: baseline;
            font-size: 14px; color: var(--text-muted); padding: 6px 0;
          }
          .checkout__renglon--total {
            color: var(--text); font-size: 18px; margin: 8px 0 16px;
            border-top: 1px solid var(--border); padding-top: 12px;
          }
          .checkout__renglon--total strong { color: var(--primary); }
          .carrito__aviso { color: var(--text-muted); font-size: 14px; margin: 12px 0; }
          .carrito__aviso--alerta { color: var(--danger); }
          .checkout__error { color: var(--danger); font-size: 14px; margin: 10px 0; }
          .boton--ancho { width: 100%; height: 44px; }
          @media (max-width: 760px) {
            .checkout { grid-template-columns: 1fr; }
          }
        `}
      </style>
    </div>
  );
}