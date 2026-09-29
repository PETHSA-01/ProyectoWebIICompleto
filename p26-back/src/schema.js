export const typeDefs = `#graphql
  """Rol que puede tener un usuario del sistema."""
  enum RolUsuario {
    ADMIN
    CLIENTE
  }

  """Estado del ciclo de vida de un pedido."""
  enum EstadoPedido {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  """Categoria del catalogo (tabla categorias)."""
  type Categoria {
    id: ID!
    nombre: String!
    "Productos que pertenecen a esta categoria (resolver de campo, relacion 1-N)."
    productos: [Producto!]!
  }

  """Producto disponible en el catalogo (tabla productos)."""
  type Producto {
    id: ID!
    nombre: String!
    precio: Float!
    imagen: String
    stock: Int!
    "Categoria a la que pertenece este producto (resolver de campo, lado N de la relacion)."
    categoria: Categoria!
  }

  """Usuario que compra en la plataforma (tabla usuarios)."""
  type Usuario {
    id: ID!
    nombre: String!
    email: String!
    rol: RolUsuario!
    "Historial de pedidos de este usuario (resolver de campo, relacion 1-N)."
    pedidos: [Pedido!]!
  }

  """Un renglon del pedido: un producto con la cantidad comprada (tabla detalle_pedido)."""
  type DetallePedido {
    id: ID!
    "Producto de este renglon (resolver de campo)."
    producto: Producto!
    cantidad: Int!
    precioUnitario: Float!
    subtotal: Float!
  }

  """Pedido realizado por un usuario (tabla pedidos)."""
  type Pedido {
    id: ID!
    fecha: String!
    total: Float!
    status: EstadoPedido!
    "Usuario que realizo el pedido (resolver de campo)."
    usuario: Usuario!
    "Renglones del pedido, cada uno con su producto y cantidad (relacion N-N via detalle_pedido)."
    detalles: [DetallePedido!]!
  }

  """Datos para crear o actualizar un producto."""
  input ProductoInput {
    nombre: String!
    precio: Float!
    imagen: String
    stock: Int!
    categoriaId: ID!
  }

  """Un renglon (producto + cantidad) al armar un pedido nuevo."""
  input DetallePedidoInput {
    productoId: ID!
    cantidad: Int!
  }

  """Datos para registrar un pedido nuevo."""
  input PedidoInput {
    usuarioId: ID!
    detalles: [DetallePedidoInput!]!
  }

  """Operaciones de lectura (no cambian el estado del sistema)."""
  type Query {
    "Lista las categorias; cada una resuelve sus propios productos (consulta anidada)."
    categorias: [Categoria!]!
    "Consulta una categoria por su identificador."
    categoria(id: ID!): Categoria

    "Catalogo de productos, paginado."
    productos(limite: Int, desde: Int): [Producto!]!
    "Consulta un producto por su identificador."
    producto(id: ID!): Producto

    "Historial de pedidos registrados."
    pedidos: [Pedido!]!
  }

  """Operaciones de escritura (registran, actualizan o eliminan datos)."""
  type Mutation {
    "Registra un producto nuevo en el catalogo."
    crearProducto(datos: ProductoInput!): Producto!
    "Actualiza los datos de un producto existente."
    actualizarProducto(id: ID!, datos: ProductoInput!): Producto
    "Elimina un producto del catalogo."
    eliminarProducto(id: ID!): Boolean!

    "Registra un pedido nuevo junto con sus renglones (productos y cantidades)."
    crearPedido(datos: PedidoInput!): Pedido!
  }
`;
