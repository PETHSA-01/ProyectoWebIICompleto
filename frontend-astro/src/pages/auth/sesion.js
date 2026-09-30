// Login y logout de OAuth2 con Google.
//
// POST        -> recibe el ID token que entrego Google Identity Services, lo
//                valida y abre la sesion (cookie httpOnly).
// GET         -> devuelve el nonce para el login (ver abajo).
// GET?salir=1 -> cierra la sesion borrando la cookie y redirige a /.
//
// El ID token NO se valida aqui del todo: la verificacion criptografica
// (firma de Google, audiencia, expiracion) la sigue haciendo el backend en
// backend/src/auth/google.js, que es la unica fuente de verdad. Lo que se
// hace aqui es el enlace entre el token y ESTE navegador (ver el chequeo de
// nonce abajo), que el backend por si solo no puede saber.
import { MUTATIONS } from '../../lib/queries.js';
import {
  escribirCookieNonce,
  escribirCookieSesion,
  generarNonce,
  leerYConsumirNonce,
  borrarCookieSesion,
} from '../../lib/sesion.js';

const ENDPOINT = import.meta.env.GRAPHQL_URL;

function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function graphqlUrl() {
  if (!ENDPOINT) {
    throw new Error('Falta GRAPHQL_URL en frontend-astro/.env.');
  }
  return ENDPOINT;
}

/**
 * Decodifica el ID token de Google (JWT de 3 partes) para leer el claim
 * "nonce" que nosotros mismos le mandamos a Google. Solo se lee: la firma
 * la verifica el backend, asi que un token con el nonce correcto pero la
 * firma falsa igual se rechaza despues, en iniciarSesionGoogle.
 */
function leerNonceDelIdToken(idToken) {
  try {
    const [, segundaParte] = idToken.split('.');
    if (!segundaParte) return null;
    const payload = JSON.parse(Buffer.from(segundaParte, 'base64url').toString('utf8'));
    return typeof payload.nonce === 'string' ? payload.nonce : null;
  } catch {
    return null;
  }
}

export async function POST({ request, cookies }) {
  let idToken;
  try {
    ({ idToken } = await request.json());
  } catch {
    return json({ error: 'Cuerpo JSON invalido.' }, 400);
  }

  if (typeof idToken !== 'string' || idToken.length === 0) {
    return json({ error: 'Falta el ID token de Google.' }, 400);
  }

  // --- Chequeo de nonce: liga el token a este navegador -----------------
  // Sin esto, alguien podria robarse un ID token de SU cuenta de Google y
  // pegarselo a otra persona, dejando la sesion iniciada como el atacante
  // (login CSRF). El nonce se genera por pestana, viaja en una cookie
  // httpOnly de un solo uso, y Google lo devuelve dentro del ID token, asi
  // que solo el navegador que inicio el login puede completarlo.
  const esperado = leerYConsumirNonce(cookies);
  if (!esperado) {
    return json({ error: 'La solicitud de login expiro. Vuelve a intentarlo.' }, 400);
  }
  if (leerNonceDelIdToken(idToken) !== esperado) {
    return json({ error: 'El token de Google no corresponde a esta sesion.' }, 400);
  }

  // --- Canje contra el backend -----------------------------------------
  // El backend verifica la firma de Google, busca/crea el usuario y emite su
  // JWT. A partir de aqui ya es el flujo de siempre.
  let data;
  try {
    const respuesta = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: MUTATIONS.iniciarSesionGoogle,
        variables: { idToken },
      }),
    });
    const texto = await respuesta.text();
    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error(`El backend devolvio una respuesta ilegible (${respuesta.status}).`);
    }
  } catch (err) {
    return json({ error: `No se pudo iniciar sesion: ${err.message}` }, 502);
  }

  if (data?.errors?.length) {
    return json({ error: data.errors[0]?.message || 'Google no acepto el token.' }, 401);
  }

  const sesion = data?.data?.iniciarSesionGoogle;
  if (!sesion?.token || !sesion?.usuario) {
    return json({ error: 'El backend no devolvio una sesion valida.' }, 502);
  }

  // El token queda atrapado en la cookie httpOnly. Al navegador solo se le
  // dan los datos publicos del usuario.
  escribirCookieSesion(cookies, sesion);
  return json({ usuario: sesion.usuario });
}

export async function DELETE() {
  return new Response(null, { status: 405 });
}

/**
 * GET = nonce para iniciar login; GET ?salir=1 = cerrar sesion.
 *
 * El logout se resuelve por GET (y no con un DELETE por fetch) a proposito:
 * el boton "Salir" es un enlace normal, asi que la sesion se cierra aunque
 * la isla no haya hidratado, React falle o el navegador bloquee el fetch.
 * Basta con que el GET llegue: se borra la cookie y se vuelve al inicio.
 */
export async function GET({ request, cookies }) {
  if (new URL(request.url).searchParams.get('salir') === '1') {
    borrarCookieSesion(cookies);
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  const nonce = generarNonce();
  escribirCookieNonce(cookies, nonce);
  return json({ nonce });
}
