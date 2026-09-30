// Queries y mutations de GraphQL, en un archivo aparte y sin ninguna
// dependencia de entorno, para que lo puedan importar tanto el servidor
// (paginas .astro y endpoints) como las islas de React sin arrastrar
// variables secretas al bundle del navegador.
//
// Documentos GraphQL plano: aqui no hay ni un fetch ni un import.meta.env.
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
