import { useEffect, useRef, useState } from 'react';
import { graphqlRequest, MUTATIONS } from '../lib/graphql.js';
import { formatoMoneda } from '../lib/formatos.js';

const PUBLIC_KEY = import.meta.env.PUBLIC_MP_PUBLIC_KEY;
const ID_CONTENEDOR = 'mp-card-brick';

// El SDK de MercadoPago.js v2 se carga una sola vez por pagina.
let promesaSdk;
function cargarSdkMercadoPago() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Sin navegador.'));
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!promesaSdk) {
    promesaSdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () =>
        window.MercadoPago
          ? resolve(window.MercadoPago)
          : reject(new Error('El SDK de Mercado Pago no se inicializo.'));
      script.onerror = () => {
        promesaSdk = undefined;
        reject(new Error('No se pudo cargar el servicio de Mercado Pago.'));
      };
      document.body.appendChild(script);
    });
  }
  return promesaSdk;
}

/**
 * Checkout API (Checkout Transparente) de Mercado Pago mediante el brick
 * `cardPayment`. El navegador tokeniza la tarjeta con la Public Key y manda
 * ese token al backend (procesarPagoMercadoPago), que ejecuta el cobro real.
 *
 * Al terminar (aprobado, rechazado o pendiente) se redirige a
 * /pago/resultado, donde se consulta el estado definitivo con verificarPago.
 */
export default function PagoMercadoPago({ pedidoId, total, payerEmail, onVolver }) {
  const contenedorRef = useRef(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!PUBLIC_KEY) {
      setCargando(false);
      setError('Mercado Pago no está configurado en este entorno.');
      return undefined;
    }

    let cancelado = false;
    let controller = null;

    const montarBrick = async () => {
      try {
        const MercadoPago = await cargarSdkMercadoPago();
        if (cancelado || !contenedorRef.current) return;

        const mp = new MercadoPago(PUBLIC_KEY, { locale: 'es-MX' });
        const bricksBuilder = mp.bricks();

        // El brick pide el ID (string) del contenedor, no el elemento DOM:
        // pasarle el elemento provoca "e.startsWith is not a function".
        controller = await bricksBuilder.create('cardPayment', ID_CONTENEDOR, {
          initialization: {
            amount: Number(total),
            payer: { email: payerEmail || '' },
          },
          customization: {
            visual: { style: { theme: 'default' } },
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) setCargando(false);
            },
            onSubmit: (formData) => {
              setProcesando(true);
              setError(null);
              return graphqlRequest(MUTATIONS.procesarPagoMercadoPago, {
                pedidoId: String(pedidoId),
                datos: {
                  token: formData.token,
                  paymentMethodId: formData.payment_method_id,
                  installments: Number(formData.installments) || 1,
                  issuerId: formData.issuer_id ? String(formData.issuer_id) : null,
                  payerEmail: formData.payer?.email || payerEmail || '',
                },
              })
                .then(() => {
                  // Aprobado, rechazado o pendiente: el estado final lo
                  // confirma /pago/resultado consultando la pasarela.
                  window.location.assign(
                    `/pago/resultado?pedido=${pedidoId}&proveedor=mercadopago`
                  );
                  return Promise.resolve();
                })
                .catch((err) => {
                  setError(`No se pudo procesar el pago: ${err.message}`);
                  setProcesando(false);
                  return Promise.reject(err);
                });
            },
            onError: (err) => {
              if (cancelado) return;
              setError(err?.message || 'Revisa los datos de la tarjeta.');
              setProcesando(false);
            },
          },
        });
      } catch (err) {
        if (!cancelado) {
          setError(err.message);
          setCargando(false);
        }
      }
    };

    montarBrick();

    return () => {
      cancelado = true;
      if (controller && typeof controller.unmount === 'function') {
        controller.unmount();
      }
    };
  }, [pedidoId, total, payerEmail]);

  return (
    <div className="mp-brick">
      <p className="mp-brick__resumen">
        Pedido <strong>#{pedidoId}</strong> · Total{' '}
        <strong>{formatoMoneda(total)}</strong>
      </p>

      {cargando && !error && <p className="mp-brick__aviso">Cargando formulario de pago…</p>}
      {procesando && <p className="mp-brick__aviso">Procesando el pago…</p>}
      {error && <p className="mp-brick__error">{error}</p>}

      <div id={ID_CONTENEDOR} ref={contenedorRef} className="mp-brick__contenedor" />

      {onVolver && (
        <button type="button" className="boton boton--texto" onClick={onVolver} disabled={procesando}>
          Volver a elegir método de pago
        </button>
      )}

      <style>{`
        .mp-brick { display: flex; flex-direction: column; gap: 14px; }
        .mp-brick__resumen { margin: 0; font-size: 15px; }
        .mp-brick__resumen strong { color: var(--primary); }
        .mp-brick__aviso { color: var(--text-muted); font-size: 14px; margin: 0; }
        .mp-brick__error { color: var(--danger); font-size: 14px; margin: 0; }
        .mp-brick__contenedor { min-height: 40px; }
      `}</style>
    </div>
  );
}
