// Integracion con Mercado Pago (Checkout API / Checkout Transparente,
// ambiente de prueba/sandbox).
//
// Flujo:
//   1. El navegador tokeniza la tarjeta con la Public Key (MercadoPago.js v2)
//      y manda el token al backend via procesarPagoMercadoPago.
//   2. crearPago() llama a POST /v1/payments con ese token y el monto del
//      pedido (external_reference = id de nuestro pedido). Mercado Pago
//      responde el estado del cobro en el momento (approved | rejected |
//      pending | in_process).
//   3. Si el pago queda pendiente, al volver a /pago/resultado se consulta el
//      estado real por external_reference y se actualiza estado_pago.
//
// Webhook: Mercado Pago firma cada notificacion con el header x-signature
// (algoritmo HMAC-SHA256). En sandbox local los webhooks no llegan (no hay
// URL publica), asi que la verificacion principal es la consulta por API.
import { createHash, createHmac } from 'node:crypto';

const MERCADOPAGO_URL = 'https://api.mercadopago.com';

// Traduccion de los status_detail de Mercado Pago a mensajes amigables para
// el cliente. Se usa tanto cuando el cobro se crea pero queda "rejected"
// (HTTP 201 con status_detail) como cuando la API responde un error 4xx/402
// cuyo "cause[0].code" coincide con uno de estos codigos.
const MENSAJES_STATUS_DETAIL = {
  APRO: 'Tu pago fue aprobado.',
  OTHE: 'El pago no se pudo procesar por un error general. Revisa tus datos o intenta con otra tarjeta.',
  CONT: 'Tu pago quedó pendiente de confirmación.',
  CALL: 'Tu banco pide que autorices la compra. Inténtalo de nuevo o contacta a tu banco.',
  FUND: 'Tu tarjeta no tiene fondos suficientes. Prueba con otra tarjeta.',
  SECU: 'El código de seguridad (CVV) es incorrecto. Revísalo e inténtalo de nuevo.',
  EXPI: 'La fecha de vencimiento de tu tarjeta es incorrecta o ya venció.',
  FORM: 'Hay un error en los datos del formulario de pago. Revísalos e inténtalo de nuevo.',
};

/**
 * Devuelve el mensaje amigable para un status_detail de Mercado Pago. Si el
 * codigo no esta en la tabla, devuelve un mensaje generico de rechazo.
 */
export function mensajeEstadoMercadoPago(statusDetail) {
  return (
    MENSAJES_STATUS_DETAIL[statusDetail] ||
    'No se pudo completar el pago. Inténtalo de nuevo o usa otra tarjeta.'
  );
}

function tokenAcceso() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Falta MP_ACCESS_TOKEN en las variables de entorno.');
  }
  return token;
}

async function apiMercadoPago(ruta, { metodo = 'GET', cuerpo, encabezados = {} } = {}) {
  const respuesta = await fetch(`${MERCADOPAGO_URL}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${tokenAcceso()}`,
      'Content-Type': 'application/json',
      ...encabezados,
    },
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
    const detalleOrders = Array.isArray(datos?.errors)
      ? datos.errors.map((e) => [e.code, e.message].filter(Boolean).join(': ')).join('; ')
      : '';
    const detalle =
      datos?.message || datos?.error || detalleOrders || (datos ? JSON.stringify(datos) : '') || 'error desconocido';
    console.error(`[mercadopago] ${metodo} ${ruta} -> ${respuesta.status}`, texto);
    const error = new Error(`Mercado Pago respondio ${respuesta.status}: ${detalle}`);
    // status_detail (o codigo de la primera "cause") para que el resolver
    // muestre un mensaje amigable en vez del error tecnico.
    error.statusDetail = datos?.status_detail || datos?.cause?.[0]?.code || null;
    throw error;
  }
  return datos;
}

/**
 * Procesa un pago con Checkout API (Checkout Transparente). Recibe el token
 * de tarjeta generado en el navegador con la Public Key y cobra el monto del
 * pedido. external_reference = id del pedido, para encontrarlo despues.
 * Devuelve { estado, idPago, statusDetail }.
 */
export async function crearPago({
  pedidoId,
  monto,
  token,
  paymentMethodId,
  installments = 1,
  issuerId,
  payerEmail,
  descripcion,
}) {
  // Idempotencia: la clave se deriva del pedido + token de tarjeta, que es
  // de un solo uso. Si el navegador reintenta el MISMO intento (timeout sin
  // respuesta clara), Mercado Pago devuelve el pago ya creado en vez de
  // generar DOS cobros por el mismo pedido.
  const idempotencyKey = createHash('sha256')
    .update(`${pedidoId}:${token}`)
    .digest('hex');

  // Cobro con la API de Orders (POST /v1/orders), igual que OXXO: es la que
  // documenta Mercado Pago para Checkout API y la que acepta el Access Token
  // de prueba (/v1/payments respondia 401 "live credentials").
  const total = Number(Number(monto).toFixed(2)).toFixed(2);
  const metodoId = String(paymentMethodId || '');
  const orden = await apiMercadoPago('/v1/orders', {
    metodo: 'POST',
    encabezados: { 'X-Idempotency-Key': idempotencyKey },
    cuerpo: {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: total,
      external_reference: String(pedidoId),
      payer: {
        // En sandbox MP solo acepta compradores de prueba: MP_TEST_PAYER_EMAIL
        // (opcional) sustituye el correo real de la sesion. Vacio en produccion.
        email: process.env.MP_TEST_PAYER_EMAIL || payerEmail,
      },
      transactions: {
        payments: [
          {
            amount: total,
            payment_method: {
              id: metodoId,
              // Las tarjetas de debito de MP llevan id "deb..." (debvisa, debmaster).
              type: /^deb/i.test(metodoId) ? 'debit_card' : 'credit_card',
              token,
              installments: Number(installments) || 1,
            },
          },
        ],
      },
    },
  });

  const pago = orden?.transactions?.payments?.[0] || {};
  const estadoOrden = String(pago.status || orden.status || '').toLowerCase();

  // Se traduce al vocabulario de /v1/payments que ya usa el resolver:
  // approved | rejected | pending | in_process.
  let estado = 'pending';
  if (estadoOrden === 'processed' || orden.status_detail === 'accredited') {
    estado = 'approved';
  } else if (['failed', 'canceled', 'cancelled', 'expired', 'rejected'].includes(estadoOrden)) {
    estado = 'rejected';
  } else if (estadoOrden === 'processing') {
    estado = 'in_process';
  }

  return {
    estado,
    idPago: pago.id || orden.id,
    statusDetail: pago.status_detail || orden.status_detail,
  };
}

/**
 * Genera un pago OXXO (pago en efectivo en tienda) con la API de Orders
 * (POST /v1/orders), que es la que Mercado Pago documenta para "otros medios
 * de pago" y la que acepta el Access Token de prueba. La ruta antigua
 * /v1/payments respondia 401 "Unauthorized use of live credentials" para
 * medios offline aun con credenciales de prueba.
 *
 * No cobra al instante: la order queda en action_required / waiting_payment
 * con una ficha para pagar en la tienda. El cobro se acredita despues
 * (webhook en produccion, verificarPago en desarrollo).
 * Devuelve { estado, idPago, urlTicket, referencia, expira }.
 */
export async function crearPagoOxxo({
  pedidoId,
  monto,
  payerEmail,
  descripcion, // eslint-disable-line no-unused-vars
}) {
  // Idempotencia: un mismo pedido no debe generar DOS fichas si el navegador
  // reintenta el mismo intento.
  const total = Number(monto).toFixed(2);
  // La clave depende del contenido (pedido + monto + correo): el mismo intento
  // repetido devuelve la misma ficha, pero cambiar el correo genera otra
  // peticion distinta y no choca (409) con la anterior.
  const idempotencyKey = createHash('sha256')
    .update(`${pedidoId}:oxxo:${total}:${String(payerEmail).toLowerCase()}`)
    .digest('hex');

  const nombre = (payerEmail || 'cliente').split('@')[0].slice(0, 30) || 'Cliente';

  let orden = await apiMercadoPago('/v1/orders', {
    metodo: 'POST',
    encabezados: { 'X-Idempotency-Key': idempotencyKey },
    cuerpo: {
      type: 'online',
      external_reference: String(pedidoId),
      processing_mode: 'automatic',
      total_amount: total,
      expiration_time: 'P3D',
      payer: {
        email: payerEmail,
        first_name: nombre,
        last_name: 'NexoPlay',
      },
      transactions: {
        payments: [
          {
            amount: total,
            payment_method: { id: 'oxxo', type: 'ticket' },
          },
        ],
      },
    },
  });

  // El procesamiento es asincrono: si la ficha aun no viene en la respuesta,
  // se consulta la order un par de veces.
  for (let intento = 0; intento < 3; intento += 1) {
    if (orden?.transactions?.payments?.[0]?.payment_method?.ticket_url) break;
    await new Promise((resolver) => setTimeout(resolver, 1000));
    orden = await apiMercadoPago(`/v1/orders/${encodeURIComponent(orden.id)}`);
  }

  const pago = orden?.transactions?.payments?.[0] || {};
  const metodo = pago.payment_method || {};
  return {
    estado: pago.status_detail === 'waiting_payment' ? 'pending' : pago.status || orden.status,
    idPago: pago.id || orden.id,
    // La ficha imprimible y la referencia que el cliente muestra en la tienda.
    urlTicket: metodo.ticket_url || null,
    referencia: metodo.reference || null,
    expira: pago.date_of_expiration || orden.expiration_time || null,
  };
}

/**
 * Consulta el estado del pago por external_reference (= id de nuestro pedido).
 * Devuelve { estado, idPago } donde estado es el status de MP:
 * approved | rejected | pending | in_process | ...
 */
export async function consultarPagoPorReferencia(externalReference) {
  const busqueda = await apiMercadoPago(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`
  );
  const resultados = busqueda?.results || [];
  if (resultados.length === 0) {
    return { estado: 'pending', idPago: null };
  }
  const pago = resultados[0];
  return { estado: pago.status, idPago: pago.id };
}

/** Consulta un pago por su id (usado por el webhook al recibir data.id). */
export async function obtenerPago(idPago) {
  const pago = await apiMercadoPago(`/v1/payments/${encodeURIComponent(idPago)}`);
  return pago;
}

/**
 * Valida la firma x-signature de un webhook de Mercado Pago, segun la
 * documentacion:
 *   firma = HMAC-SHA256(secreto, "id:{data.id};request-id:{x-request-id};ts:{ts};")
 * Devuelve true/false.
 */
export function validarFirmaWebhook({ xSignature, xRequestId, dataId }) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return false;
  if (!xSignature || !xRequestId || !dataId) return false;

  const pares = Object.fromEntries(
    (xSignature || '')
      .split(',')
      .map((kv) => kv.split('=').map((s) => s.trim()))
  );
  const ts = pares.ts;
  const firmaRecibida = pares.v1;
  if (!ts || !firmaRecibida) return false;

  const mensaje = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const firmaCalculada = createHmac('sha256', secreto).update(mensaje).digest('hex');
  return firmaCalculada === firmaRecibida;
}