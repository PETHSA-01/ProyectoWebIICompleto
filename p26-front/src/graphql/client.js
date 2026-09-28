const ENDPOINT = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4001/';

/**
 * Ejecuta una operacion GraphQL (query o mutation) contra el backend.
 * Tema 7 del recurso (Fetching): una peticion asincrona por operacion.
 */
export async function graphqlRequest(query, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Error de red (${response.status}) al consultar el servidor.`);
  }

  const { data, errors } = await response.json();

  if (errors && errors.length > 0) {
    throw new Error(errors[0].message || 'El servidor devolvio un error.');
  }

  return data;
}

export const QUERIES = {
  categorias: `
    query Categorias {
      categorias {
        id
        nombre
        productos { id }
      }
    }
  `,
  categoria: `
    query Categoria($id: ID!) {
      categoria(id: $id) {
        id
        nombre
        productos {
          id
          nombre
          precio
          imagen
          stock
        }
      }
    }
  `,
  producto: `
    query Producto($id: ID!) {
      producto(id: $id) {
        id
        nombre
        precio
        imagen
        stock
        categoria { id nombre }
      }
    }
  `,
  productosDestacados: `
    query ProductosDestacados($limite: Int) {
      productos(limite: $limite, desde: 0) {
        id
        nombre
        precio
        imagen
        stock
        categoria { id nombre }
      }
    }
  `,
  productosPaginados: `
    query ProductosPaginados($limite: Int, $desde: Int) {
      productos(limite: $limite, desde: $desde) {
        id
        nombre
        precio
        imagen
        stock
        categoria { id nombre }
      }
    }
  `,
};
