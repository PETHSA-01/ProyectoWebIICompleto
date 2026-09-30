import { M as MUTATIONS } from '../../chunks/queries_CNBrlWqk.mjs';
import { b as borrarCookieSesion, g as generarNonce, e as escribirCookieNonce, a as leerYConsumirNonce, c as escribirCookieSesion } from '../../chunks/sesion_uA2PStyq.mjs';
export { renderers } from '../../renderers.mjs';

const ENDPOINT = "http://localhost:4001/";
function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function graphqlUrl() {
  return ENDPOINT;
}
function leerNonceDelIdToken(idToken) {
  try {
    const [, segundaParte] = idToken.split(".");
    if (!segundaParte) return null;
    const payload = JSON.parse(Buffer.from(segundaParte, "base64url").toString("utf8"));
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}
async function POST({ request, cookies }) {
  let idToken;
  try {
    ({ idToken } = await request.json());
  } catch {
    return json({ error: "Cuerpo JSON invalido." }, 400);
  }
  if (typeof idToken !== "string" || idToken.length === 0) {
    return json({ error: "Falta el ID token de Google." }, 400);
  }
  const esperado = leerYConsumirNonce(cookies);
  if (!esperado) {
    return json({ error: "La solicitud de login expiro. Vuelve a intentarlo." }, 400);
  }
  if (leerNonceDelIdToken(idToken) !== esperado) {
    return json({ error: "El token de Google no corresponde a esta sesion." }, 400);
  }
  let data;
  try {
    const respuesta = await fetch(graphqlUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: MUTATIONS.iniciarSesionGoogle,
        variables: { idToken }
      })
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
    return json({ error: data.errors[0]?.message || "Google no acepto el token." }, 401);
  }
  const sesion = data?.data?.iniciarSesionGoogle;
  if (!sesion?.token || !sesion?.usuario) {
    return json({ error: "El backend no devolvio una sesion valida." }, 502);
  }
  escribirCookieSesion(cookies, sesion);
  return json({ usuario: sesion.usuario });
}
async function DELETE() {
  return new Response(null, { status: 405 });
}
async function GET({ request, cookies }) {
  if (new URL(request.url).searchParams.get("salir") === "1") {
    borrarCookieSesion(cookies);
    return new Response(null, { status: 302, headers: { Location: "/" } });
  }
  const nonce = generarNonce();
  escribirCookieNonce(cookies, nonce);
  return json({ nonce });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  DELETE,
  GET,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
