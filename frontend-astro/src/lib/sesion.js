// Gestion de la sesion en el LADO DEL SERVIDOR de Astro.
//
// El JWT que emite el backend (backend/src/auth/jwt.js) no viaja ya en el
// localStorage del navegador, sino dentro de una cookie httpOnly que solo el
// servidor de Astro puede leer. Asi el token es invisible para cualquier
// script de la pagina: un XSS ya no puede robarlo.
//
// La cookie lleva dos partes separadas por un punto:
//
//     <base64url(payload)>.<firma HMAC-SHA256>
//
// donde payload = { token, usuario }. La firma usa SESSION_SECRET y sirve
// para que el navegador no pueda inventarse una sesion ajena. OJO: esta
// firma NO es la validacion del JWT. La firma criptografica del JWT y la
// expiracion real las sigue validando el backend cuando recibe la peticion
// (backend/src/auth/google.js y context.js). Aqui solo evitamos que el
// cliente manipule el sobre.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const NOMBRE_COOKIE = 'nexoplay_sesion';
const NOMBRE_COOKIE_NONCE = 'nexoplay_nonce';

// 7 dias, la misma duracion que JWT_EXPIRES_IN en el backend, para que la
// cookie muera al mismo tiempo que el token que envuelve.
const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 7;

// Vida corta: el nonce solo sirve para validar un unico login en curso.
const MAX_AGE_NONCE = 60 * 10;

// Estos valores se leen de process.env y NO de import.meta.env a proposito.
// import.meta.env se resuelve en build time, asi que un valor ausente en el
// .env del build queda congelado como undefined para siempre y no se puede
// corregir al arrancar sin recompilar. process.env se lee al arrancar, que es
// lo que hace falta para un secreto: se puede desplegar con otro valor sin
// volver a compilar. Solo aplica a este archivo, que es 100% de servidor.
function leerEntorno(nombre) {
  return process.env[nombre] ?? import.meta.env[nombre];
}

function obtenerSecreto() {
  const secreto = leerEntorno('SESSION_SECRET');
  if (!secreto) {
    throw new Error(
      'Falta SESSION_SECRET en frontend-astro/.env. Genera uno con:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  return secreto;
}

function firmar(datos) {
  return createHmac('sha256', obtenerSecreto()).update(datos).digest('base64url');
}

/**
 * Compara dos cadenas en tiempo constante, para que un atacante no pueda
 * deducir la firma correcta probando caracter a caracter midiendo el tiempo
 * que tarda el servidor en responder.
 */
function compararSeguras(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function generarNonce() {
  return randomBytes(16).toString('hex');
}

// Secure se activa solo en builds de produccion, que es donde corresponde:
// la cookie tiene que viajar por HTTPS para que no se lea en el camino.
// Se puede forzar con SESSION_COOKIE_SECURE=false cuando se prueba un build
// de produccion sirviendo por http://localhost (en desarrollo Astro ya lo
// deja en false por su cuenta, asi que no hace falta ahi).
function cookieSecure() {
  const forzado = leerEntorno('SESSION_COOKIE_SECURE');
  if (forzado === 'false') return false;
  if (forzado === 'true') return true;
  return Boolean(import.meta.env.PROD);
}

export function opcionesCookieSesion() {
  return {
    httpOnly: true,
    // "Lax" (y no "Strict") porque con "Strict" la cookie NO viaja cuando el
    // usuario llega desde un enlace externo, y al volver de Google lo
    // perderiamos.
    sameSite: 'lax',
    path: '/',
    secure: cookieSecure(),
    maxAge: MAX_AGE_SEGUNDOS,
  };
}

export function opcionesCookieNonce() {
  return { ...opcionesCookieSesion(), maxAge: MAX_AGE_NONCE };
}

/**
 * Arma la cookie de sesion a partir de lo que devuelve la mutacion
 * iniciarSesionGoogle. El token NO se devuelve nunca al navegador: se
 * guarda aqui adentro y el cliente solo recibe los datos publicos del
 * usuario.
 */
export function escribirCookieSesion(cookies, { token, usuario }) {
  const payload = Buffer.from(JSON.stringify({ token, usuario })).toString('base64url');
  cookies.set(NOMBRE_COOKIE, `${payload}.${firmar(payload)}`, opcionesCookieSesion());
}

export function escribirCookieNonce(cookies, nonce) {
  cookies.set(NOMBRE_COOKIE_NONCE, nonce, opcionesCookieNonce());
}

export function borrarCookieSesion(cookies) {
  cookies.delete(NOMBRE_COOKIE, { path: '/' });
}

/**
 * Consume el nonce: lo lee y lo borra en el mismo paso, para que un token
 * de Google no se pueda reutilizar ni aunque se robe la peticion.
 * Se pide en POST /auth/sesion.
 */
export function leerYConsumirNonce(cookies) {
  const nonce = cookies.get(NOMBRE_COOKIE_NONCE)?.value;
  cookies.delete(NOMBRE_COOKIE_NONCE, { path: '/' });
  return nonce || null;
}

/**
 * Lee la cookie de sesion y verifica la firma. Devuelve
 * { token, usuario } o null si no hay cookie, si la firma no cuadra o si el
 * sobre esta corrupto. Nunca lanza: una cookie manipulada se trata igual
 * que "no hay sesion", que es exactamente lo que es.
 */
export function leerCookieSesion(cookies) {
  const bruto = cookies.get(NOMBRE_COOKIE)?.value;
  if (!bruto) return null;

  const separador = bruto.lastIndexOf('.');
  if (separador < 1) return null;

  const payload = bruto.slice(0, separador);
  const firma = bruto.slice(separador + 1);

  let esperada;
  try {
    esperada = firmar(payload);
  } catch {
    // Sin SESSION_SECRET no se puede validar nada: es sesion de nadie.
    return null;
  }
  if (!compararSeguras(firma, esperada)) return null;

  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!datos?.token || !datos?.usuario) return null;
    return datos;
  } catch {
    return null;
  }
}

/**
 * Decodifica el JWT (sin verificar la firma, que es tarea del backend) para
 * leer su claim "exp" y saber si caduco. Sirve para dar el mensaje correcto
 * ("tu sesion expiro") en vez de un error de red generico, y para que el
 * servidor no mande peticiones con un token que ya no va a servir.
 */
export function tokenCaducado(token) {
  if (!token) return true;
  try {
    const [, segundaParte] = token.split('.');
    if (!segundaParte) return true;
    const payload = JSON.parse(Buffer.from(segundaParte, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export { NOMBRE_COOKIE, NOMBRE_COOKIE_NONCE };
