// Proxy GraphQL same-origin.
//
// Antes, el navegador POSTeaba directo a http://localhost:4001/ y mandaba
// "Authorization: Bearer <jwt>". Con la sesion en cookie httpOnly eso ya no
// es posible: la cookie pertenece a este servidor (localhost:4321) y nunca
// viaja a :4001, que es otro origen. Ademas, una cookie httpOnly no es
// legible por JS, asi que el token no se puede añadir a mano.
//
// Este endpoint resuelve el problema: el navegador le habla a /api/graphql
// (mismo origen, la cookie va sola), y el servidor le pone el header
// Authorization al reenviar la peticion al backend real.
import { leerCookieSesion, tokenCaducado } from '../../lib/sesion.js';

const ENDPOINT = import.meta.env.GRAPHQL_URL;

function graphqlUrl() {
  if (!ENDPOINT) {
    throw new Error(
      'Falta GRAPHQL_URL en frontend-astro/.env. Debe apuntar al backend GraphQL.'
    );
  }
  return ENDPOINT;
}

// El backend lanza Error plano (y no AuthenticationError) cuando hace falta
// sesion, asi que Apollo lo devuelve con code INTERNAL_SERVER_ERROR y HTTP
// 200: no hay forma de que el navegador distinga "sesion expirada" de
// "se cayo la base de datos". Traducimos esos mensajes a 401 para que la
// isla pueda reaccionar bien.
const MENSAJES_SIN_SESION = [
  'Necesitas iniciar sesion para hacer esto.',
  'Necesitas iniciar sesión para hacer esto.',
];

function esErrorDeSesion(mensaje = '') {
  return MENSAJES_SIN_SESION.some((m) => mensaje.includes(m));
}

export async function POST({ request, cookies }) {
  if (request.headers.get('content-type') !== 'application/json') {
    return new Response(JSON.stringify({ error: 'Se esperaba application/json.' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cuerpo = await request.text();
  if (cuerpo.length > 100_000) {
    return new Response(JSON.stringify({ error: 'Cuerpo demasiado grande.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Una cookie vieja o manipulada se descarta sola: si el token ya caduco,
  // la borramos para que el proximo request no la vuelva a mandar.
  const sesion = leerCookieSesion(cookies);
  let token = null;
  if (sesion) {
    if (tokenCaducado(sesion.token)) {
      cookies.delete('nexoplay_sesion', { path: '/' });
    } else {
      token = sesion.token;
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(graphqlUrl(), {
      method: 'POST',
      headers,
      body: cuerpo,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'No se pudo contactar al backend GraphQL.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const texto = await respuesta.text();

  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }

  if (!respuesta.ok) {
    return new Response(
      JSON.stringify({ error: `El backend respondio ${respuesta.status}.` }),
      { status: respuesta.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (json?.errors?.length && esErrorDeSesion(json.errors[0]?.message)) {
    // 401 explicito para "no hay sesion valida", en vez del error ambiguo.
    return new Response(JSON.stringify(json), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // El backend puede contestar HTTP 200 y aun asi traer errors[]. Se respeta
  // su codigo cuando lo manda; si no, se devuelve tal cual.
  const status = typeof json?.errors?.[0]?.extensions?.http?.status === 'number'
    ? json.errors[0].extensions.http.status
    : 200;

  return new Response(texto, { status, headers: { 'Content-Type': 'application/json' } });
}
