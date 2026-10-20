// Login y registro LOCAL (correo + contrasena) frente al backend GraphQL.
//
// POST /auth/local con { action: "login" | "register", email, password, nombre? }.
// El backend valida las credenciales, emite el JWT y aqui se guarda en la
// misma cookie httpOnly que usa el login con Google. El token nunca vuelve
// al navegador.
import { MUTATIONS } from '../../lib/queries.js';
import { escribirCookieSesion } from '../../lib/sesion.js';

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

export async function POST({ request, cookies }) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ error: 'Cuerpo JSON invalido.' }, 400);
  }

  const { action } = cuerpo;
  const email = (cuerpo.email || '').trim().toLowerCase();
  const password = cuerpo.password || '';

  if (action !== 'login' && action !== 'register') {
    return json({ error: 'Accion invalida (usa login o register).' }, 400);
  }
  if (!email || !password) {
    return json({ error: 'Correo y contrasena son obligatorios.' }, 400);
  }

  const variables =
    action === 'login'
      ? { email, password }
      : { datos: { nombre: (cuerpo.nombre || '').trim(), email, password } };

  let data;
  try {
    const respuesta = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: action === 'login' ? MUTATIONS.iniciarSesion : MUTATIONS.registrarse,
        variables,
      }),
    });
    const texto = await respuesta.text();
    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error(`El backend devolvio una respuesta ilegible (${respuesta.status}).`);
    }
  } catch (err) {
    return json({ error: `No se pudo completar la accion: ${err.message}` }, 502);
  }

  if (data?.errors?.length) {
    return json({ error: data.errors[0]?.message || 'La solicitud fue rechazada.' }, 401);
  }

  const sesion = data?.data?.[action === 'login' ? 'iniciarSesion' : 'registrarse'];
  if (!sesion?.token || !sesion?.usuario) {
    return json({ error: 'El backend no devolvio una sesion valida.' }, 502);
  }

  escribirCookieSesion(cookies, sesion);
  return json({ usuario: sesion.usuario });
}