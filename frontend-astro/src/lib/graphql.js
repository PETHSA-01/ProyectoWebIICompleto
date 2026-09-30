// Cliente GraphQL compartido: lo usan TANTO las paginas .astro (corren en
// Node, en el servidor, en cada peticion) COMO las islas de React (corren
// en el navegador).
//
// El destino depende de quien llama. En el servidor se va directo al
// backend, porque ahi no hay problema con las cookies. En el navegador se va
// a /api/graphql, el proxy de este mismo proyecto: la sesion viaja en una
// cookie httpOnly de este origen, y una cookie httpOnly (a) no se puede leer
// desde JS para mandarla a mano y (b) nunca viaja a otro origen como el
// puerto 4001. El proxy lee la cookie en el servidor y le pone el header
// Authorization al backend. GRAPHQL_URL va sin PUBLIC_ justamente para que
// no se exponga al cliente: la rama del servidor se elimina al compilar
// para el navegador.
const ENDPOINT = import.meta.env.SSR
  ? import.meta.env.GRAPHQL_URL || 'http://localhost:4001/'
  : '/api/graphql';

// El parametro "token" se conserva para no romper a los llamadores del
// servidor, pero en el navegador ya no se usa: el token viaja en la cookie
// httpOnly y lo adjunta el proxy. Mandarlo desde aca ademas ya no serviria
// de nada, porque /api/graphql corre en este mismo origen y la cookie manda
// sola.
export async function graphqlRequest(query, variables = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (import.meta.env.SSR && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    // El status viaja en el error para que la isla pueda distinguir un 401
    // (sesion expirada) de un 500 (algo se cayo), en vez de pintar el mismo
    // texto para los dos casos.
    const error = new Error(`Error de red (${response.status}) al consultar el servidor.`);
    error.status = response.status;
    throw error;
  }

  const { data, errors } = await response.json();
  if (errors && errors.length > 0) {
    const error = new Error(errors[0].message || 'El servidor devolvio un error.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export { QUERIES, MUTATIONS } from './queries.js';
