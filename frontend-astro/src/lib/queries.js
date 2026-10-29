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
  // Productos + categorias completas para el panel de administracion.
  catalogoAdmin: `
    query CatalogoAdmin {
      categorias { id nombre }
      productos(limite: 500) {
        id nombre precio imagen stock sku stockMinimo bajoMinimo
        costoAdquisicion margen activo categoria { id nombre }
      }
    }
  `,
  pedidosAdmin: `
    query PedidosAdmin($estado: EstadoPedido) {
      pedidos(estado: $estado) {
        id
        fecha
        total
        status
        metodoPago
        estadoPago
        usuario { id nombre email }
      }
    }
  `,
  pedidoDetalleAdmin: `
    query PedidoDetalleAdmin($id: ID!) {
      pedido(id: $id) {
        id
        fecha
        total
        status
        metodoPago
        estadoPago
        referenciaPago
        idPago
        usuario { id nombre email }
        detalles {
          cantidad
          precioUnitario
          subtotal
          costoUnitarioSnapshot
          producto { id nombre }
        }
      }
    }
  `,
  estadisticasPanel: `
    query EstadisticasPanel {
      estadisticasPanel {
        ingresosTotales
        ticketPromedio
        totalPedidos
        pedidosPorEstado { estado cantidad }
        stockBajo { id nombre stock precio }
        pedidosRecientes {
          id fecha total status estadoPago
          usuario { nombre email }
        }
      }
    }
  `,
  misPedidos: `
    query MisPedidos {
      pedidos {
        id
        fecha
        total
        subtotal
        impuestos
        costoEnvio
        status
        metodoPago
        estadoPago
        detalles { cantidad producto { id nombre } }
        envio {
          paqueteria
          numeroGuia
          urlRastreo
          fechaEntregaEstimada
          simulado: simulada
          entregadoEn
        }
      }
    }
  `,
  // Pedido propio, para retomar un pago pendiente desde Mis Órdenes:
  // /carrito?pagar=<id>. El resolver `pedido(id)` exige ser el dueño.
  miPedidoPendiente: `
    query MiPedidoPendiente($id: ID!) {
      pedido(id: $id) {
        id
        total
        status
        metodoPago
        estadoPago
        referenciaPago
        ticketUrl
        detalles { cantidad subtotal producto { id nombre } }
      }
    }
  `,
  pedidoResultado: `
    query PedidoResultado($id: ID!) {
      pedido(id: $id) {
        id
        total
        status
        metodoPago
        estadoPago
        fechaPago
        detalles { cantidad producto { nombre } }
      }
    }
  `,
  // --- ERP: dashboard e inventario ---------------------------------------
  resumenDashboard: `
    query ResumenDashboard {
      resumenDashboard {
        utilidadMes
        margenMes
        productosBajoMinimo
        pedidosPorAtender
        ordenesCompraPendientes
      }
    }
  `,
  inventarioAdmin: `
    query InventarioAdmin {
      productos(limite: 500, incluirInactivos: true) {
        id nombre sku stock stockMinimo bajoMinimo costoAdquisicion margen
        precio activo categoria { nombre }
      }
      productosBajoMinimo { id nombre stock stockMinimo }
      movimientosInventario(limite: 60) {
        id tipo cantidad origen referenciaId motivo fecha
        producto { id nombre }
        usuario { nombre }
      }
    }
  `,
  // --- ERP: compras y proveedores ---------------------------------------
  comprasAdmin: `
    query ComprasAdmin {
      proveedores { id nombre contacto email telefono marcasDistribuidas
        condicionesPago diasCredito notas activo saldoPendiente }
      ordenesCompra {
        id fecha estado subtotal impuestos total recibidaEn
        proveedor { id nombre }
        usuario { nombre }
        detalles { id cantidad costoUnitario subtotal producto { id nombre stock } }
      }
      productos(limite: 500) { id nombre sku stock costoAdquisicion }
    }
  `,
  // --- ERP: ventas y facturacion ----------------------------------------
  ventasAdmin: `
    query VentasAdmin {
      pedidos {
        id fecha total subtotal impuestos tasaImpuesto costoEnvio status estadoPago
        metodoPago usuario { id nombre email }
        factura { id serie folio estado uuidFiscal }
        detalles {
          cantidad precioUnitario subtotal costoUnitarioSnapshot
          producto { id nombre }
        }
      }
    }
  `,
  facturacionAdmin: `
    query FacturacionAdmin {
      facturas {
        id serie folio rfc razonSocial regimenFiscal usoCfdi codigoPostalFiscal
        subtotal impuestos total estado uuidFiscal emitidaEn
        pedido { id usuario { nombre email } }
      }
    }
  `,
  // --- ERP: envios -------------------------------------------------------
  enviosAdmin: `
    query EnviosAdmin {
      pedidos {
        id fecha total subtotal status estadoPago
        direccionEnvio ciudad estadoGeo codigoPostal telefonoContacto
        usuario { id nombre email }
        detalles { cantidad producto { nombre } }
        envio { id paqueteria numeroGuia urlRastreo costoEnvio
                fechaCreacion fechaEntregaEstimada entregadoEn simulada }
      }
    }
  `,
  // --- ERP: clientes / CRM ----------------------------------------------
  clientesAdmin: `
    query ClientesAdmin {
      clientes {
        id nombre email avatarUrl totalPedidos totalGastado ticketPromedio
        primeraCompra ultimaCompra ticketsAbiertos
      }
      ticketsSoporte {
        id asunto descripcion estado prioridad creadoEn cerradoEn
        usuario { id nombre email }
        pedido { id }
      }
    }
  `,
  perfilCliente: `
    query PerfilCliente($id: ID!) {
      perfilCliente(usuarioId: $id) {
        totalPedidos totalGastado ticketPromedio primeraCompra ultimaCompra
        categoriaFavorita ticketsAbiertos
        productosMasComprados { productoId nombre cantidad }
        usuario { id nombre email avatarUrl }
      }
      ticketsSoporte(usuarioId: $id) {
        id asunto descripcion estado prioridad creadoEn
      }
      pedidos { id fecha total status usuario { id } }
    }
  `,
  // --- ERP: reportes -----------------------------------------------------
  reportesAdmin: `
    query ReportesAdmin($desde: String, $hasta: String) {
      estadoResultados(desde: $desde, hasta: $hasta) {
        ingresos costoVentas utilidadBruta margenPorcentaje ivaTrasladado
        ingresosConCosto pedidosHistoricos renglonesSinCosto
        serieMensual { mes ingresos iva costoVentas utilidad }
      }
      rotacionInventario(desde: $desde, hasta: $hasta) {
        unidadesVendidas ingresos costo utilidad vecesRotado diasInventario
        bajaRotacion
        producto { id nombre stock precio costoAdquisicion }
      }
      movimientosContables {
        id fecha tipo cuenta monto concepto origen referenciaId
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
        estadoPago
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
  iniciarSesion: `
    mutation IniciarSesion($email: String!, $password: String!) {
      iniciarSesion(email: $email, password: $password) {
        token
        usuario { id nombre email rol avatarUrl }
      }
    }
  `,
  registrarse: `
    mutation Registrarse($datos: RegistroInput!) {
      registrarse(datos: $datos) {
        token
        usuario { id nombre email rol }
      }
    }
  `,
  procesarPagoMercadoPago: `
    mutation ProcesarPagoMercadoPago($pedidoId: ID!, $datos: PagoMercadoPagoInput!) {
      procesarPagoMercadoPago(pedidoId: $pedidoId, datos: $datos) {
        id
        status
        estadoPago
        total
      }
    }
  `,
  procesarPagoOxxo: `
    mutation ProcesarPagoOxxo($pedidoId: ID!, $datos: PagoOxxoInput!) {
      procesarPagoOxxo(pedidoId: $pedidoId, datos: $datos) {
        id
        estado
        url
        referencia
        expira
      }
    }
  `,
  iniciarPagoPayPal: `
    mutation IniciarPagoPayPal($pedidoId: ID!) {
      iniciarPagoPayPal(pedidoId: $pedidoId) { id url }
    }
  `,
  confirmarPagoPayPal: `
    mutation ConfirmarPagoPayPal($pedidoId: ID!, $orderId: String!) {
      confirmarPagoPayPal(pedidoId: $pedidoId, orderId: $orderId) {
        id status estadoPago
      }
    }
  `,
  verificarPago: `
    mutation VerificarPago($pedidoId: ID!) {
      verificarPago(pedidoId: $pedidoId) {
        id status estadoPago fechaPago metodoPago referenciaPago ticketUrl
      }
    }
  `,
  crearProducto: `
    mutation CrearProducto($datos: ProductoInput!) {
      crearProducto(datos: $datos) {
        id nombre precio imagen stock categoria { id }
      }
    }
  `,
  actualizarProducto: `
    mutation ActualizarProducto($id: ID!, $datos: ProductoInput!) {
      actualizarProducto(id: $id, datos: $datos) {
        id nombre precio imagen stock categoria { id }
      }
    }
  `,
  eliminarProducto: `
    mutation EliminarProducto($id: ID!) {
      eliminarProducto(id: $id)
    }
  `,
  actualizarEstadoPedido: `
    mutation ActualizarEstadoPedido($id: ID!, $estado: EstadoPedido!) {
      actualizarEstadoPedido(id: $id, estado: $estado) {
        id status estadoPago
      }
    }
  `,
  // --- ERP: inventario y compras ---------------------------------------
  ajustarStock: `
    mutation AjustarStock($productoId: ID!, $cantidad: Int!, $motivo: String!) {
      ajustarStock(productoId: $productoId, cantidad: $cantidad, motivo: $motivo) {
        id nombre stock
      }
    }
  `,
  actualizarUmbralStock: `
    mutation ActualizarUmbral($productoId: ID!, $stockMinimo: Int!) {
      actualizarUmbralStock(productoId: $productoId, stockMinimo: $stockMinimo) {
        id nombre stock stockMinimo
      }
    }
  `,
  crearProveedor: `
    mutation CrearProveedor($datos: ProveedorInput!) {
      crearProveedor(datos: $datos) { id nombre }
    }
  `,
  actualizarProveedor: `
    mutation ActualizarProveedor($id: ID!, $datos: ProveedorInput!) {
      actualizarProveedor(id: $id, datos: $datos) { id nombre }
    }
  `,
  crearOrdenCompra: `
    mutation CrearOrdenCompra($proveedorId: ID!, $renglones: [RenglonOCInput!]!) {
      crearOrdenCompra(proveedorId: $proveedorId, renglones: $renglones) {
        id estado subtotal impuestos total
      }
    }
  `,
  recibirOrdenCompra: `
    mutation RecibirOrdenCompra($id: ID!) {
      recibirOrdenCompra(id: $id) { id estado recibidaEn }
    }
  `,
  cancelarOrdenCompra: `
    mutation CancelarOrdenCompra($id: ID!) {
      cancelarOrdenCompra(id: $id) { id estado }
    }
  `,
  // --- ERP: facturacion --------------------------------------------------
  emitirFactura: `
    mutation EmitirFactura($pedidoId: ID!, $datos: DatosFiscalesInput!) {
      emitirFactura(pedidoId: $pedidoId, datos: $datos) {
        id serie folio rfc razonSocial subtotal impuestos total estado uuidFiscal xml
      }
    }
  `,
  cancelarFactura: `
    mutation CancelarFactura($id: ID!) {
      cancelarFactura(id: $id) { id estado }
    }
  `,
  // --- ERP: logistica ----------------------------------------------------
  crearGuia: `
    mutation CrearGuia($pedidoId: ID!, $paqueteria: Paqueteria, $paquete: PaqueteInput) {
      crearGuia(pedidoId: $pedidoId, paqueteria: $paqueteria, paquete: $paquete) {
        id paqueteria numeroGuia urlRastreo costoEnvio
        fechaEntregaEstimada simulada
      }
    }
  `,
  marcarEntregado: `
    mutation MarcarEntregado($pedidoId: ID!) {
      marcarEntregado(pedidoId: $pedidoId) { id status }
    }
  `,
  // --- ERP: CRM ----------------------------------------------------------
  crearTicketSoporte: `
    mutation CrearTicketSoporte($datos: TicketSoporteInput!) {
      crearTicketSoporte(datos: $datos) {
        id asunto estado prioridad creadoEn
      }
    }
  `,
  cambiarEstadoTicket: `
    mutation CambiarEstadoTicket($id: ID!, $estado: EstadoTicket!) {
      cambiarEstadoTicket(id: $id, estado: $estado) { id estado }
    }
  `,
};