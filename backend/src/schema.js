export const typeDefs = `#graphql
  """Rol que puede tener un usuario del sistema."""
  enum RolUsuario {
    ADMIN
    CLIENTE
  }

  """Proveedor con el que el usuario inicio sesion."""
  enum ProveedorAuth {
    LOCAL
    GOOGLE
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
    avatarUrl: String
    authProvider: ProveedorAuth!
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

  """
  Resultado de iniciar sesion: el usuario autenticado y un JWT propio.
  Ese mismo JWT sirve para autorizar tanto este API de GraphQL (claim "rol")
  como las llamadas directas a PostgREST (claim "role", usado para SET ROLE).
  """
  type SesionAuth {
    token: String!
    usuario: Usuario!
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

  """
  Datos para registrar un pedido nuevo.
  NOTA de diseno (Proyecto Final): a diferencia de la practica P2-6, aqui
  YA NO se recibe "usuarioId" desde el cliente. El usuario del pedido se
  toma del JWT autenticado (context.usuario), para que nadie pueda crear
  pedidos a nombre de otra persona con solo cambiar un numero en la peticion.
  """
  input PedidoInput {
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

    "Historial de pedidos. Un CLIENTE solo ve los suyos; un ADMIN los ve todos."
    pedidos: [Pedido!]!

    "Usuario actualmente autenticado (segun el JWT enviado), o null si no hay sesion."
    yo: Usuario
  }

  """Operaciones de escritura (registran, actualizan o eliminan datos)."""
  type Mutation {
    "Registra un producto nuevo en el catalogo. Requiere rol ADMIN."
    crearProducto(datos: ProductoInput!): Producto!
    "Actualiza los datos de un producto existente. Requiere rol ADMIN."
    actualizarProducto(id: ID!, datos: ProductoInput!): Producto
    "Elimina un producto del catalogo. Requiere rol ADMIN."
    eliminarProducto(id: ID!): Boolean!

    "Registra un pedido nuevo junto con sus renglones. Requiere sesion iniciada."
    crearPedido(datos: PedidoInput!): Pedido!

    """
    Inicia sesion con un ID token de Google (obtenido en el frontend via
    Google Identity Services). Crea el usuario si es su primera vez, o lo
    vincula a una cuenta LOCAL existente con el mismo correo.
    """
    iniciarSesionGoogle(idToken: String!): SesionAuth!
  }
`;
