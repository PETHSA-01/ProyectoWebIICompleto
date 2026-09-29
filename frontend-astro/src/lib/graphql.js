// Cliente GraphQL compartido: lo usan TANTO las paginas .astro (corren en
// Node, en el servidor, en cada peticion) COMO las islas de React (corren
// en el navegador). Por eso usa import.meta.env.PUBLIC_GRAPHQL_URL, que
// Astro expone en ambos entornos.
const ENDPOINT = import.meta.env.PUBLIC_GRAPHQL_URL || 'http://localhost:4001/';

export async function graphqlRequest(query, variables = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
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
      categorias { id nombre productos { id } }
    }
  `,
  categoria: `
    query Categoria($id: ID!) {
      categoria(id: $id) {
        id
        nombre
        productos { id nombre precio imagen stock }
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
        id nombre precio imagen stock categoria { id nombre }
      }
    }
  `,
};

export const MUTATIONS = {
  crearPedido: `
    mutation CrearPedido($d: PedidoInput!) {
      crearPedido(datos: $d) {
        id
        total
        status
        detalles { cantidad subtotal producto { nombre } }
      }
    }
  `,
  iniciarSesionGoogle: `
    mutation IniciarSesionGoogle($idToken: String!) {
      iniciarSesionGoogle(idToken: $idToken) {
        token
        usuario { id nombre email rol avatarUrl }
      }
    }
  `,
};
