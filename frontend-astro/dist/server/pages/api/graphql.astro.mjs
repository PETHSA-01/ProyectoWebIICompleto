import { l as leerCookieSesion, t as tokenCaducado } from '../../chunks/sesion_uA2PStyq.mjs';
export { renderers } from '../../renderers.mjs';

const ENDPOINT = "http://localhost:4001/";
function graphqlUrl() {
  return ENDPOINT;
}
const MENSAJES_SIN_SESION = [
  "Necesitas iniciar sesion para hacer esto.",
  "Necesitas iniciar sesión para hacer esto."
];
function esErrorDeSesion(mensaje = "") {
  return MENSAJES_SIN_SESION.some((m) => mensaje.includes(m));
}
async function POST({ request, cookies }) {
  if (request.headers.get("content-type") !== "application/json") {
    return new Response(JSON.stringify({ error: "Se esperaba application/json." }), {
      status: 415,
      headers: { "Content-Type": "application/json" }
    });
  }
  const cuerpo = await request.text();
  if (cuerpo.length > 1e5) {
    return new Response(JSON.stringify({ error: "Cuerpo demasiado grande." }), {
      status: 413,
      headers: { "Content-Type": "application/json" }
    });
  }
  const sesion = leerCookieSesion(cookies);
  let token = null;
  if (sesion) {
    if (tokenCaducado(sesion.token)) {
      cookies.delete("nexoplay_sesion", { path: "/" });
    } else {
      token = sesion.token;
    }
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let respuesta;
  try {
    respuesta = await fetch(graphqlUrl(), {
      method: "POST",
      headers,
      body: cuerpo
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "No se pudo contactar al backend GraphQL." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
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
      { status: respuesta.status, headers: { "Content-Type": "application/json" } }
    );
  }
  if (json?.errors?.length && esErrorDeSesion(json.errors[0]?.message)) {
    return new Response(JSON.stringify(json), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const status = typeof json?.errors?.[0]?.extensions?.http?.status === "number" ? json.errors[0].extensions.http.status : 200;
  return new Response(texto, { status, headers: { "Content-Type": "application/json" } });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
