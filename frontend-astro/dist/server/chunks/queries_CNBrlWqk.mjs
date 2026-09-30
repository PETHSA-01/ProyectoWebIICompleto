const QUERIES = {
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
  `
};
const MUTATIONS = {
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
  `
};

export { MUTATIONS as M, QUERIES as Q };
