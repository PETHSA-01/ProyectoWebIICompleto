import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "PUBLIC_GOOGLE_CLIENT_ID": "983738489619-47afiu5jemougd5jma1qtqo8b9gtsr3o.apps.googleusercontent.com", "SITE": undefined, "SSR": true};
const NOMBRE_COOKIE = "nexoplay_sesion";
const NOMBRE_COOKIE_NONCE = "nexoplay_nonce";
const MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 7;
const MAX_AGE_NONCE = 60 * 10;
function leerEntorno(nombre) {
  return process.env[nombre] ?? Object.assign(__vite_import_meta_env__, { SESSION_SECRET: "97e735adc3050e69fe1d4813dae3711168113956c6f035a49bffefd7fd690ad16b55b999eba59c3c58015a59be6145a6", _: process.env._ })[nombre];
}
function obtenerSecreto() {
  const secreto = leerEntorno("SESSION_SECRET");
  if (!secreto) {
    throw new Error(
      `Falta SESSION_SECRET en frontend-astro/.env. Genera uno con:
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  return secreto;
}
function firmar(datos) {
  return createHmac("sha256", obtenerSecreto()).update(datos).digest("base64url");
}
function compararSeguras(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
function generarNonce() {
  return randomBytes(16).toString("hex");
}
function cookieSecure() {
  const forzado = leerEntorno("SESSION_COOKIE_SECURE");
  if (forzado === "false") return false;
  if (forzado === "true") return true;
  return Boolean(Object.assign(__vite_import_meta_env__, { SESSION_SECRET: "97e735adc3050e69fe1d4813dae3711168113956c6f035a49bffefd7fd690ad16b55b999eba59c3c58015a59be6145a6", _: process.env._ }).PROD);
}
function opcionesCookieSesion() {
  return {
    httpOnly: true,
    // "Lax" (y no "Strict") porque con "Strict" la cookie NO viaja cuando el
    // usuario llega desde un enlace externo, y al volver de Google lo
    // perderiamos.
    sameSite: "lax",
    path: "/",
    secure: cookieSecure(),
    maxAge: MAX_AGE_SEGUNDOS
  };
}
function opcionesCookieNonce() {
  return { ...opcionesCookieSesion(), maxAge: MAX_AGE_NONCE };
}
function escribirCookieSesion(cookies, { token, usuario }) {
  const payload = Buffer.from(JSON.stringify({ token, usuario })).toString("base64url");
  cookies.set(NOMBRE_COOKIE, `${payload}.${firmar(payload)}`, opcionesCookieSesion());
}
function escribirCookieNonce(cookies, nonce) {
  cookies.set(NOMBRE_COOKIE_NONCE, nonce, opcionesCookieNonce());
}
function borrarCookieSesion(cookies) {
  cookies.delete(NOMBRE_COOKIE, { path: "/" });
}
function leerYConsumirNonce(cookies) {
  const nonce = cookies.get(NOMBRE_COOKIE_NONCE)?.value;
  cookies.delete(NOMBRE_COOKIE_NONCE, { path: "/" });
  return nonce || null;
}
function leerCookieSesion(cookies) {
  const bruto = cookies.get(NOMBRE_COOKIE)?.value;
  if (!bruto) return null;
  const separador = bruto.lastIndexOf(".");
  if (separador < 1) return null;
  const payload = bruto.slice(0, separador);
  const firma = bruto.slice(separador + 1);
  let esperada;
  try {
    esperada = firmar(payload);
  } catch {
    return null;
  }
  if (!compararSeguras(firma, esperada)) return null;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!datos?.token || !datos?.usuario) return null;
    return datos;
  } catch {
    return null;
  }
}
function tokenCaducado(token) {
  if (!token) return true;
  try {
    const [, segundaParte] = token.split(".");
    if (!segundaParte) return true;
    const payload = JSON.parse(Buffer.from(segundaParte, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1e3 <= Date.now();
  } catch {
    return true;
  }
}

export { leerYConsumirNonce as a, borrarCookieSesion as b, escribirCookieSesion as c, escribirCookieNonce as e, generarNonce as g, leerCookieSesion as l, tokenCaducado as t };
