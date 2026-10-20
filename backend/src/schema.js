export const typeDefs = `#graphql
  """Rol que puede tener un usuario del sistema."""
  enum RolUsuario {
    ADMIN
    OPERADOR
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

  """Pasarela de pago elegida por el cliente para pagar un pedido."""
  enum MetodoPago {
    MERCADO_PAGO
    PAYPAL
    OXXO
  }

  """Estado del cobro, independiente del estado del pedido."""
  enum EstadoPago {
    PENDIENTE
    APROBADO
    RECHAZADO
    CANCELADO
  }

  """Estado de una orden de compra a proveedor."""
  enum EstadoOC {
    BORRADOR
    RECIBIDA
    CANCELADA
  }

  """Condiciones de pago acordadas con un proveedor."""
  enum CondicionesPago {
    CONTADO
    CREDITO_30
    CREDITO_60
  }

  """Tipo de movimiento en el libro de inventario."""
  enum TipoMovimientoInventario {
    ENTRADA
    SALIDA
    AJUSTE
  }

  """Que hecho origino un movimiento de inventario."""
  enum OrigenMovimientoInventario {
    OC
    PEDIDO
    AJUSTE_MANUAL
    CANCELACION
  }

  """Naturaleza de un asiento contable."""
  enum TipoMovimientoContable {
    INGRESO
    EGRESO
  }

  """Cuenta contable afectada por un asiento."""
  enum CuentaContable {
    CAJA
    BANCO
    INVENTARIO
    COSTO_VENTAS
    IVA_TRASLADADO
    IVA_ACREDITABLE
  }

  """Hecho economico que origino un asiento contable."""
  enum OrigenContable {
    PEDIDO
    OC
    CANCELACION
  }

  """Estado de un ticket de soporte."""
  enum EstadoTicket {
    ABIERTO
    EN_PROCESO
    CERRADO
  }

  """Prioridad de un ticket de soporte."""
  enum PrioridadTicket {
    BAJA
    MEDIA
    ALTA
  }

  """Paqueteria usada para un envio. SIMULADA genera guias de demostracion."""
  enum Paqueteria {
    DHL
    ESTAFETA
    FEDEX
    SIMULADA
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
    "Categoria a la que pertenece este producto (nula si no tiene)."
    categoria: Categoria
    "Costo de adquisicion mas reciente (lo actualiza recibirOrdenCompra)."
    costoAdquisicion: Float!
    "Margen bruto en porcentaje: (precio - costo) / precio * 100."
    margen: Float!
    "Codigo interno del producto (opcional, unico)."
    sku: String
    "Umbral propio de alerta de stock bajo."
    stockMinimo: Int!
    "true cuando stock <= stockMinimo."
    bajoMinimo: Boolean!
    "Baja logica: los productos inactivos no se muestran en el catalogo."
    activo: Boolean!
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
    "Costo unitario congelado al momento de la venta (para el margen)."
    costoUnitarioSnapshot: Float
  }

  """Pedido realizado por un usuario (tabla pedidos)."""
  type Pedido {
    id: ID!
    fecha: String!
    "Total cobrado = subtotal + impuestos + costoEnvio."
    total: Float!
    "Suma de los renglones, sin impuestos ni envio."
    subtotal: Float!
    "IVA u otros impuestos trasladados."
    impuestos: Float!
    "Tasa aplicada (0.16 por defecto; 0.08 en frontera; 0 exento)."
    tasaImpuesto: Float!
    "Costo de envio cobrado en este pedido."
    costoEnvio: Float!
    "Direccion de entrega capturada al comprar."
    direccionEnvio: String
    ciudad: String
    estadoGeo: String
    codigoPostal: String
    telefonoContacto: String
    status: EstadoPedido!
    "Pasarela con la que el cliente dijo que iba a pagar (si ya eligio)."
    metodoPago: MetodoPago
    "Estado del cobro (PENDIENTE hasta que la pasarela lo acredite)."
    estadoPago: EstadoPago!
    "Id de la preferencia (Mercado Pago) u orden (PayPal) en la pasarela."
    referenciaPago: String
    "Id del pago ya capturado en la pasarela (si aprobo)."
    idPago: String
    "Ficha (external_resource_url) de un pago OXXO pendiente, si aplica."
    ticketUrl: String
    "Fecha en que se acredito el pago."
    fechaPago: String
    "Usuario que realizo el pedido (resolver de campo)."
    usuario: Usuario!
    "Renglones del pedido, cada uno con su producto y cantidad (relacion N-N via detalle_pedido)."
    detalles: [DetallePedido!]!
    "Guia de envio asociada, si ya se genero."
    envio: Envio
    "Factura fiscal emitida para este pedido, si existe."
    factura: Factura
    "Bitacora de cambios de estado (quien y cuando)."
    historial: [HistorialEstado!]!
  }

  """Respuesta de una pasarela: a donde hay que redirigir al cliente."""
  type UrlPago {
    id: String!
    url: String
  }

  """Ficha de un pago OXXO: el cliente la lleva impresa a la tienda.
  El cobro queda PENDIENTE hasta que OXXO confirma el pago."""
  type TicketPago {
    "Id del pago OXXO en Mercado Pago."
    id: String!
    "Estado del cobro en la pasarela (normalmente PENDIENTE)."
    estado: EstadoPago!
    "Ficha imprimible (external_resource_url) con el codigo de barras."
    url: String
    "Referencia que el cajero de OXXO debe capturar."
    referencia: String
    "Fecha limite para pagar la ficha."
    expira: String
  }

  """Resultado de iniciar sesion: el usuario autenticado y un JWT propio.
  Ese mismo JWT sirve para autorizar tanto este API de GraphQL (claim "rol")
  como las llamadas directas a PostgREST (claim "role", usado para SET ROLE)."""
  type SesionAuth {
    token: String!
    usuario: Usuario!
  }

  """Conteo de pedidos en un mismo estado (para el panel)."""
  type ConteoEstado {
    estado: EstadoPedido!
    cantidad: Int!
  }

  """Metricas basicas del panel administrativo."""
  type EstadisticasPanel {
    "Suma de los pedidos no cancelados."
    ingresosTotales: Float!
    "Total ingresado / total de pedidos no cancelados."
    ticketPromedio: Float!
    "Cantidad de pedidos (todos los estados)."
    totalPedidos: Int!
    "Pedidos por estado (PENDING, CONFIRMED, ...)."
    pedidosPorEstado: [ConteoEstado!]!
    "Productos con stock bajo (menor o igual al limite indicado)."
    stockBajo: [Producto!]!
    "Los pedidos mas recientes (tope indicado)."
    pedidosRecientes: [Pedido!]!
  }

  """Datos para crear o actualizar un producto."""
  input ProductoInput {
    nombre: String!
    precio: Float!
    imagen: String
    stock: Int!
    "Categoria del producto (nula si el producto no pertenece a ninguna)."
    categoriaId: ID
    "Costo de adquisicion (base para el margen)."
    costoAdquisicion: Float
    "Codigo interno unico (opcional)."
    sku: String
    "Umbral propio de alerta de stock bajo (default 5)."
    stockMinimo: Int
    "false = baja logica (deja de mostrarse en el catalogo)."
    activo: Boolean
  }

  """Un renglon (producto + cantidad) al armar un pedido nuevo."""
  input DetallePedidoInput {
    productoId: ID!
    cantidad: Int!
  }

  """Datos del pago con tarjeta para Mercado Pago (Checkout API). El token y
  el metodo los genera MercadoPago.js v2 en el navegador con la Public Key;
  nunca llegan los datos crudos de la tarjeta al backend."""
  input PagoMercadoPagoInput {
    "Token de tarjeta de un solo uso generado por MercadoPago.js."
    token: String!
    "payment_method_id devuelto por el brick (visa, master, etc.)."
    paymentMethodId: String!
    "Numero de cuotas elegido (al menos 1)."
    installments: Int
    "Banco emisor, cuando el brick lo devuelve."
    issuerId: String
    "Correo del pagador (requerido por Mercado Pago)."
    payerEmail: String!
  }

  """Datos del pago en efectivo en tienda OXXO (Checkout API de Mercado Pago).
  Solo hace falta el correo del pagador; el monto y el pedido los toma el backend."""
  input PagoOxxoInput {
    "Correo del pagador (OXXO lo usa para la confirmacion del pago)."
    payerEmail: String!
  }

  """Datos para registrar un pedido nuevo.
  El usuario del pedido se toma del JWT autenticado, nunca del cliente."""
  input PedidoInput {
    metodoPago: MetodoPago
    detalles: [DetallePedidoInput!]!
    "Tasa de impuesto a aplicar (0.16 por defecto)."
    tasaImpuesto: Float
    "Costo de envio a cobrar (0 por defecto)."
    costoEnvio: Float
    direccionEnvio: String
    ciudad: String
    estadoGeo: String
    codigoPostal: String
    telefonoContacto: String
  }

  """Datos para crear una cuenta local (login con correo/contraseña)."""
  input RegistroInput {
    nombre: String!
    email: String!
    password: String!
  }

  # ---------------------------------------------------------------
  # ERP — Inventario, compras y proveedores
  # ---------------------------------------------------------------

  """Proveedor/distribuidor mayorista (tabla proveedores)."""
  type Proveedor {
    id: ID!
    nombre: String!
    contacto: String
    email: String
    telefono: String
    marcasDistribuidas: String
    condicionesPago: CondicionesPago!
    diasCredito: Int!
    notas: String
    activo: Boolean!
    "Ordenes de compra hechas a este proveedor (mas recientes primero)."
    ordenesCompra: [OrdenCompra!]!
    "Saldo de OC recibidas a credito (no hay registro de pagos a proveedor)."
    saldoPendiente: Float!
  }

  """Un renglon de una orden de compra (tabla detalle_oc)."""
  type DetalleOC {
    id: ID!
    producto: Producto!
    cantidad: Int!
    costoUnitario: Float!
    subtotal: Float!
  }

  """Orden de compra a un proveedor (tabla ordenes_compra)."""
  type OrdenCompra {
    id: ID!
    proveedor: Proveedor!
    fecha: String!
    estado: EstadoOC!
    subtotal: Float!
    impuestos: Float!
    total: Float!
    recibidaEn: String
    usuario: Usuario
    detalles: [DetalleOC!]!
  }

  """Renglon del libro de inventario (tabla movimientos_inventario)."""
  type MovimientoInventario {
    id: ID!
    producto: Producto!
    tipo: TipoMovimientoInventario!
    "Delta con signo aplicado al stock (ENTRADA +, SALIDA -)."
    cantidad: Int!
    origen: OrigenMovimientoInventario!
    referenciaId: ID
    motivo: String
    usuario: Usuario
    fecha: String!
  }

  """Datos para crear/actualizar un proveedor."""
  input ProveedorInput {
    nombre: String!
    contacto: String
    email: String
    telefono: String
    marcasDistribuidas: String
    condicionesPago: CondicionesPago
    diasCredito: Int
    notas: String
    activo: Boolean
  }

  """Un renglon al crear una orden de compra."""
  input RenglonOCInput {
    productoId: ID!
    cantidad: Int!
    costoUnitario: Float!
  }

  # ---------------------------------------------------------------
  # ERP — Contabilidad y facturacion
  # ---------------------------------------------------------------

  """Asiento del libro contable (tabla movimientos_contables)."""
  type MovimientoContable {
    id: ID!
    fecha: String!
    tipo: TipoMovimientoContable!
    cuenta: CuentaContable!
    monto: Float!
    concepto: String!
    origen: OrigenContable!
    referenciaId: ID
    usuario: Usuario
  }

  """Factura CFDI 4.0 generada (sin timbrar: requiere PAC)."""
  type Factura {
    id: ID!
    pedido: Pedido!
    serie: String!
    folio: Int!
    rfc: String!
    razonSocial: String!
    regimenFiscal: String!
    usoCfdi: String!
    codigoPostalFiscal: String!
    subtotal: Float!
    impuestos: Float!
    total: Float!
    estado: String!
    "UUID del timbre fiscal; vacio mientras no se timbre con un PAC."
    uuidFiscal: String
    emitidaEn: String!
    "XML CFDI 4.0 completo (estructura valida, sin timbre)."
    xml: String!
  }

  """Datos fiscales del receptor para emitir la factura."""
  input DatosFiscalesInput {
    rfc: String!
    razonSocial: String!
    "Clave del regimen fiscal del SAT (ej. 601, 612, 626)."
    regimenFiscal: String!
    "Uso del CFDI (ej. G01, G03, I08)."
    usoCfdi: String!
    codigoPostalFiscal: String!
    "Serie de la factura (A por defecto)."
    serie: String
  }

  # ---------------------------------------------------------------
  # ERP — Logistica y envios
  # ---------------------------------------------------------------

  """Guia de envio de un pedido (tabla envios)."""
  type Envio {
    id: ID!
    pedido: Pedido!
    paqueteria: Paqueteria!
    numeroGuia: String!
    urlRastreo: String
    costoEnvio: Float!
    fechaCreacion: String!
    fechaEntregaEstimada: String
    entregadoEn: String
    "true si la guia es de demostracion (sin contrato con la paqueteria)."
    simulada: Boolean!
  }

  """Un cambio de estado de un pedido, con quien y cuando (tabla historial_estados_pedido)."""
  type HistorialEstado {
    id: ID!
    estadoAnterior: String
    estadoNuevo: String!
    comentario: String
    usuario: Usuario
    fecha: String!
  }

  """Medidas del paquete para cotizar la guia."""
  input PaqueteInput {
    pesoKg: Float
    altoCm: Float
    anchoCm: Float
    largoCm: Float
  }

  # ---------------------------------------------------------------
  # ERP — CRM y tickets de soporte
  # ---------------------------------------------------------------

  """Resumen de un cliente para el listado del CRM."""
  type ClienteResumen {
    id: ID!
    nombre: String!
    email: String!
    avatarUrl: String
    totalPedidos: Int!
    totalGastado: Float!
    ticketPromedio: Float!
    primeraCompra: String
    ultimaCompra: String
    ticketsAbiertos: Int!
  }

  """Conteo de unidades compradas de un producto (sin resolver N+1)."""
  type ConteoProducto {
    productoId: ID!
    nombre: String!
    cantidad: Int!
  }

  """Perfil de cliente construido por agregacion sobre pedidos existentes."""
  type PerfilCliente {
    usuario: Usuario!
    totalPedidos: Int!
    totalGastado: Float!
    ticketPromedio: Float!
    primeraCompra: String
    ultimaCompra: String
    categoriaFavorita: String
    productosMasComprados: [ConteoProducto!]!
    ticketsAbiertos: Int!
  }

  """Ticket de soporte de un cliente (tabla tickets_soporte)."""
  type TicketSoporte {
    id: ID!
    usuario: Usuario!
    pedido: Pedido
    asunto: String!
    descripcion: String!
    estado: EstadoTicket!
    prioridad: PrioridadTicket!
    creadoEn: String!
    cerradoEn: String
  }

  """Datos para abrir un ticket de soporte."""
  input TicketSoporteInput {
    "Solo el panel puede abrir un ticket a nombre de otro usuario."
    usuarioId: ID
    pedidoId: ID
    asunto: String!
    descripcion: String!
    prioridad: PrioridadTicket
  }

  # ---------------------------------------------------------------
  # ERP — Reportes financieros
  # ---------------------------------------------------------------

  """Un mes de la serie del estado de resultados."""
  type SerieMensual {
    mes: String!
    ingresos: Float!
    iva: Float!
    costoVentas: Float!
    utilidad: Float!
  }

  """Estado de resultados del periodo (calculado sobre subtotal, no sobre total:
  el IVA no es ingreso)."""
  type EstadoResultados {
    ingresos: Float!
    costoVentas: Float!
    utilidadBruta: Float!
    margenPorcentaje: Float!
    ivaTrasladado: Float!
    "Ingresos de pedidos que SI tienen costo registrado (base del margen)."
    ingresosConCosto: Float!
    "Pedidos historicos sin costo: suman ingresos pero no margen."
    pedidosHistoricos: Int!
    "Renglones historicos sin costo snapshot (se excluyen del margen)."
    renglonesSinCosto: Int!
    "Serie mensual para la grafica."
    serieMensual: [SerieMensual!]!
  }

  """Rotacion de un producto en el periodo (aproximada con el stock actual)."""
  type RotacionProducto {
    producto: Producto!
    unidadesVendidas: Int!
    ingresos: Float!
    costo: Float!
    utilidad: Float!
    vecesRotado: Float!
    diasInventario: Float!
    bajaRotacion: Boolean!
  }

  """KPIs gerenciales de portada, en una sola consulta."""
  type ResumenDashboard {
    utilidadMes: Float!
    margenMes: Float!
    productosBajoMinimo: Int!
    pedidosPorAtender: Int!
    ordenesCompraPendientes: Int!
  }

  """Operaciones de lectura (no cambian el estado del sistema)."""
  type Query {
    "Lista las categorias; cada una resuelve sus propios productos (consulta anidada)."
    categorias: [Categoria!]!
    "Consulta una categoria por su identificador."
    categoria(id: ID!): Categoria

    "Catalogo de productos, paginado. Por defecto solo activos."
    productos(limite: Int, desde: Int, incluirInactivos: Boolean): [Producto!]!
    "Consulta un producto por su identificador."
    producto(id: ID!): Producto

    "Productos con stock en o por debajo de su propio umbral. Requiere ADMIN u OPERADOR."
    productosBajoMinimo: [Producto!]!

    "Directorio de proveedores. Requiere ADMIN u OPERADOR."
    proveedores(activo: Boolean): [Proveedor!]!
    "Un proveedor con su historial de compras. Requiere ADMIN u OPERADOR."
    proveedor(id: ID!): Proveedor

    "Ordenes de compra, opcionalmente filtradas por estado. Requiere ADMIN u OPERADOR."
    ordenesCompra(estado: EstadoOC): [OrdenCompra!]!
    "Detalle de una orden de compra. Requiere ADMIN u OPERADOR."
    ordenCompra(id: ID!): OrdenCompra

    "Libro de inventario (se puede filtrar por producto y tipo). Requiere ADMIN u OPERADOR."
    movimientosInventario(productoId: ID, tipo: TipoMovimientoInventario, limite: Int): [MovimientoInventario!]!

    "Libro contable del periodo. Requiere ADMIN (informacion financiera)."
    movimientosContables(desde: String, hasta: String, origen: OrigenContable): [MovimientoContable!]!
    "Facturas emitidas. Requiere ADMIN."
    facturas: [Factura!]!

    "Envios generados, opcionalmente por paqueteria. Requiere ADMIN u OPERADOR."
    envios(paqueteria: Paqueteria): [Envio!]!
    "Bitacora de estados de un pedido. Requiere ADMIN u OPERADOR."
    historialPedido(pedidoId: ID!): [HistorialEstado!]!

    "Listado de clientes con sus totales de compra. Requiere ADMIN u OPERADOR."
    clientes(busqueda: String): [ClienteResumen!]!
    "Perfil agregado de un cliente. Requiere ADMIN u OPERADOR."
    perfilCliente(usuarioId: ID!): PerfilCliente
    "Tickets de soporte (de un usuario o todos). Requiere ADMIN u OPERADOR."
    ticketsSoporte(usuarioId: ID): [TicketSoporte!]!

    "Estado de resultados del periodo. Requiere ADMIN."
    estadoResultados(desde: String, hasta: String): EstadoResultados!
    "Rotacion de inventario por producto. Requiere ADMIN."
    rotacionInventario(desde: String, hasta: String): [RotacionProducto!]!
    "KPIs gerenciales de portada. Requiere ADMIN u OPERADOR."
    resumenDashboard: ResumenDashboard!

    "Historial de pedidos. Un CLIENTE solo ve los suyos; el equipo del panel ve todos."
    pedidos(estado: EstadoPedido): [Pedido!]!

    "Consulta un pedido por su id (el dueno del pedido o el equipo del panel)."
    pedido(id: ID!): Pedido

    "Metricas del panel administrativo. Requiere rol ADMIN u OPERADOR."
    estadisticasPanel(limiteStock: Int, topeRecientes: Int): EstadisticasPanel!

    "Usuario actualmente autenticado (segun el JWT enviado), o null si no hay sesion."
    yo: Usuario
  }

  """Operaciones de escritura (registran, actualizan o eliminan datos)."""
  type Mutation {
    "Registra un producto nuevo en el catalogo. Requiere rol ADMIN u OPERADOR."
    crearProducto(datos: ProductoInput!): Producto!
    "Actualiza los datos de un producto existente. Requiere rol ADMIN u OPERADOR."
    actualizarProducto(id: ID!, datos: ProductoInput!): Producto
    "Elimina un producto del catalogo. Requiere rol ADMIN u OPERADOR."
    eliminarProducto(id: ID!): Boolean!

    "Registra un pedido nuevo junto con sus renglones. Requiere sesion iniciada."
    crearPedido(datos: PedidoInput!): Pedido!

    "Cambia el estado de un pedido (confirmar, enviar, entregar, cancelar). Requiere rol ADMIN u OPERADOR."
    actualizarEstadoPedido(id: ID!, estado: EstadoPedido!): Pedido

    "Crea una cuenta local (rol CLIENTE) y devuelve la sesion ya iniciada."
    registrarse(datos: RegistroInput!): SesionAuth!

    "Inicia sesion con correo y contrasena local. Devuelve la sesion y su JWT."
    iniciarSesion(email: String!, password: String!): SesionAuth!

    """
    Inicia sesion con un ID token de Google (obtenido en el frontend via
    Google Identity Services). Crea el usuario si es su primera vez, o lo
    vincula a una cuenta LOCAL existente con el mismo correo.
    """
    iniciarSesionGoogle(idToken: String!): SesionAuth!

    "Procesa el pago de un pedido con Mercado Pago (Checkout API/Transparente)."
    procesarPagoMercadoPago(pedidoId: ID!, datos: PagoMercadoPagoInput!): Pedido!

    "Genera una ficha de pago en efectivo OXXO para un pedido (Checkout API)."
    procesarPagoOxxo(pedidoId: ID!, datos: PagoOxxoInput!): TicketPago!

    "Crea la orden de pago en PayPal para un pedido y devuelve la URL de aprobacion."
    iniciarPagoPayPal(pedidoId: ID!): UrlPago!

    "Captura en PayPal una orden ya aprobada por el comprador (se llama al volver)."
    confirmarPagoPayPal(pedidoId: ID!, orderId: String!): Pedido!

    "Consulta el estado real del cobro contra la pasarela y actualiza la orden si procede."
    verificarPago(pedidoId: ID!): Pedido!

    # --- ERP: inventario y compras -------------------------------------
    "Crea/edita un proveedor. Requiere ADMIN."
    crearProveedor(datos: ProveedorInput!): Proveedor!
    actualizarProveedor(id: ID!, datos: ProveedorInput!): Proveedor

    "Crea una orden de compra en BORRADOR. Requiere ADMIN u OPERADOR."
    crearOrdenCompra(proveedorId: ID!, renglones: [RenglonOCInput!]!): OrdenCompra!
    "Recibe una OC: entra stock, se actualiza el costo y se generan asientos. Requiere ADMIN u OPERADOR."
    recibirOrdenCompra(id: ID!): OrdenCompra!
    "Cancela una OC que aun esta en BORRADOR. Requiere ADMIN u OPERADOR."
    cancelarOrdenCompra(id: ID!): OrdenCompra!

    "Ajuste manual de stock (motivo obligatorio). Requiere ADMIN u OPERADOR."
    ajustarStock(productoId: ID!, cantidad: Int!, motivo: String!): Producto!
    "Cambia el umbral de alerta de stock de un producto. Requiere ADMIN u OPERADOR."
    actualizarUmbralStock(productoId: ID!, stockMinimo: Int!): Producto!

    # --- ERP: facturacion ----------------------------------------------
    "Emite una factura CFDI 4.0 (sin timbrar; requiere PAC). Requiere ADMIN."
    emitirFactura(pedidoId: ID!, datos: DatosFiscalesInput!): Factura!
    "Cancela una factura emitida (no genera cancelacion ante el SAT sin PAC). Requiere ADMIN."
    cancelarFactura(id: ID!): Factura

    # --- ERP: logistica ------------------------------------------------
    "Genera la guia de envio y marca el pedido como enviado. Requiere ADMIN u OPERADOR."
    crearGuia(pedidoId: ID!, paqueteria: Paqueteria, paquete: PaqueteInput): Envio!
    "Marca un pedido enviado como entregado. Requiere ADMIN u OPERADOR."
    marcarEntregado(pedidoId: ID!): Pedido

    # --- ERP: CRM ------------------------------------------------------
    "Abre un ticket de soporte (el cliente para si mismo; el panel para cualquiera)."
    crearTicketSoporte(datos: TicketSoporteInput!): TicketSoporte!
    "Cambia el estado de un ticket. Requiere ADMIN u OPERADOR."
    cambiarEstadoTicket(id: ID!, estado: EstadoTicket!): TicketSoporte
  }
`;