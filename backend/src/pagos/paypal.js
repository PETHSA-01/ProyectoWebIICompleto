// Integracion con PayPal (Orders API v2, ambiente de prueba/sandbox).
//
// Flujo:
//   1. iniciarPagoPayPal(pedidoId) crea una orden de pago (intent CAPTURE)
//      con reference_id = id de nuestro pedido. De la respuesta se toma el
//      enlace rel="approve" y se redirige al cliente a PayPal.
//   2. Cuando el cliente aprueba, PayPal lo regresa a return_url. Ahí el
//      frontend llama a confirmarPagoPayPal(pedidoId, orderId) y el backend
//      ejecuta la captura; si queda COMPLETED, se marca el cobro APROBADO.
import { Buffer } from 'node:buffer';

function baseApi() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function clienteId() {
  const id = process.env.PAYPAL_CLIENT_ID;
  if (!id) throw new Error('Falta PAYPAL_CLIENT_ID en las variables de entorno.');
  return id;
}

function secreto() {
  const secret = process.env.PAYPAL_SECRET;
  if (!secret) throw new Error('Falta PAYPAL_SECRET en las variables de entorno.');
  return secret;
}

function moneda() {
  return process.env.PAYPAL_CURRENCY_CODE || 'MXN';
}

async function apiPayPal(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const encabezados = {
    'Content-Type': 'application/json',
  };
  if (token) {
    encabezados.Authorization = `Bearer ${token}`;
  }
  const respuesta = await fetch(`${baseApi()}${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { error: texto };
  }
  if (!respuesta.ok) {
    const detalles = Array.isArray(datos?.details)
      ? datos.details
          .map((d) => [d.field, d.issue, d.description].filter(Boolean).join(' - '))
          .join('; ')
      : '';
    console.error(`[paypal] ${metodo} ${ruta} -> ${respuesta.status}`, texto);
    throw new Error(
      `PayPal respondio ${respuesta.status}: ${datos?.message || datos?.error_description || 'error desconocido'}${detalles ? ` (${detalles})` : ''}`
    );
  }
  return datos;
}

let cacheToken = null;

/** Obtiene (y cachea) el access token de OAuth de la app de sandbox. */
async function obtenerToken() {
  if (cacheToken) return cacheToken;

  const credenciales = `${clienteId()}:${secreto()}`;
  const respuesta = await fetch(`${baseApi()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(credenciales).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.access_token) {
    throw new Error(`PayPal no emitio token de acceso: ${datos.error_description || datos.error}`);
  }
  cacheToken = datos.access_token;
  return cacheToken;
}

/**
 * Crea una orden de pago en PayPal para un pedido. reference_id = id del
 * pedido. Devuelve { id, url } donde url es el enlace rel="approve" al que
 * se redirige al cliente.
 */
export async function crearOrden({ pedidoId, total }) {
  const token = await obtenerToken();
  // APP_URL puede llegar con espacios o un salto de linea al final (pasa al
  // pegarla en el panel de Render) o con "/" final: PayPal rechaza el
  // return_url con un 400 si queda mal formado.
  const appUrl = (process.env.APP_URL || 'http://localhost:4321')
    .trim()
    .replace(/\/+$/, '');
  const query = `pedido=${pedidoId}&proveedor=paypal`;

  const orden = await apiPayPal('/v2/checkout/orders', {
    metodo: 'POST',
    token,
    cuerpo: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: String(pedidoId),
          invoice_id: String(pedidoId),
          description: `Pedido #${pedidoId} - NexoPlay`,
          amount: {
            currency_code: moneda(),
            value: Number(total).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'NexoPlay',
        return_url: `${appUrl}/pago/resultado?${query}`,
        cancel_url: `${appUrl}/pago/resultado?estado=cancelado&${query}`,
      },
    },
  });

  const aprobar = orden.links?.find((l) => l.rel === 'approve');
  return { id: orden.id, url: aprobar?.href || null };
}

/**
 * Captura el cobro de una orden ya aprobada por el comprador. Devuelve
 * { estado, idPago } donde estado es "COMPLETED" si el dinero quedo capturado.
 */
export async function capturarOrden(orderId) {
  const token = await obtenerToken();
  const captura = await apiPayPal(`/v2/checkout/orders/${orderId}/capture`, {
    metodo: 'POST',
    token,
    cuerpo: {},
  });

  const idPago = captura.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
  return { estado: captura.status, idPago };
}

/** Consulta el estado actual de una orden de pago. */
export async function consultarOrden(orderId) {
  const token = await obtenerToken();
  const orden = await apiPayPal(`/v2/checkout/orders/${orderId}`, { token });
  return { estado: orden.status, id: orden.id };
}