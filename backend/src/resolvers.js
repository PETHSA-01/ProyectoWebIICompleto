import { query, queryOne, withTransaction } from './db.js';
import { requerirAdmin, requerirPanel, requerirUsuario } from './auth/context.js';
import { firmarToken } from './auth/jwt.js';
import { verificarIdTokenGoogle, buscarOCrearUsuarioGoogle } from './auth/google.js';
import { crearHash, verificarPassword } from './auth/password.js';
import { crearPago as crearPagoMercadoPago, crearPagoOxxo, consultarPagoPorReferencia, mensajeEstadoMercadoPago } from './pagos/mercadopago.js';
import { crearOrden as crearOrdenPayPal, capturarOrden, consultarOrden } from './pagos/paypal.js';
import { marcarPagoAprobado, marcarPagoFallido } from './pagos/estado-pedido.js';
import { publicarStock, escucharStock } from './eventos.js';
import { registrarMovimiento } from './inventario/movimientos.js';
import { revertirAsientosVenta } from './contabilidad/asientos.js';
import { resolversInventario } from './inventario/resolvers.js';
import { resolversFinanzas } from './finanzas/resolvers.js';
import { resolversLogistica } from './logistica/resolvers.js';
import { resolversCrm } from './crm/resolvers.js';
import { resolversReportes } from './reportes/resolvers.js';
import { fechaHora } from './util/fechas.js';

// Estados siguientes permitidos al cambiar el estado de un pedido desde el
// panel. La cancelacion se permite desde PENDING/CONFIRMED/SHIPPED y devuelve
// el stock. Estados terminales (DELIVERED, CANCELLED) no cambian.
const TRANSICIONES = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Valida la entrada de crear/actualizar producto antes de tocar la base. */
function validarProductoInput(datos) {
  const nombre = (datos.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del producto es obligatorio.');
  const precio = Number(datos.precio);
  const stock = Number(datos.stock);
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error('El precio debe ser un numero mayor o igual a cero.');
  }
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
    throw new Error('El stock debe ser un entero mayor o igual a cero.');
  }
  const costo = Number(datos.costoAdquisicion ?? 0);
  if (!Number.isFinite(costo) || costo < 0) {
    throw new Error('El costo de adquisicion debe ser un numero mayor o igual a cero.');
  }
  const stockMinimo = Number(datos.stockMinimo ?? 5);
  if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
    throw new Error('El stock minimo debe ser un entero mayor o igual a cero.');
  }
  return {
    ...datos,
    nombre,
    precio,
    stock,
    costoAdquisicion: costo,
    stockMinimo,
    sku: (datos.sku || '').trim() || null,
    activo: datos.activo ?? true,
  };
}

/** Mensaje claro si el SKU (unico) ya esta ocupado por otro producto. */
function errorSkuDuplicado(error) {
  if (error && error.code === '23505') {
    return new Error('Ya existe otro producto con ese SKU.');
  }
  return error;
}

/** Valida que el usuario pueda ver/operar un pedido (dueno o equipo del panel). */
async function pedidoAutorizado(id, usuario) {
  const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [id]);
  if (!pedido) {
    throw new Error(`No existe un pedido con id ${id}`);
  }
  const esEquipoPanel = usuario.rol === 'ADMIN' || usuario.rol === 'OPERADOR';
  if (!esEquipoPanel && pedido.usuario_id !== usuario.id) {
    throw new Error('Este pedido no te pertenece.');
  }
  return pedido;
}

const resolversBase = {
  Query: {
    categorias: () => query('SELECT * FROM categorias ORDER BY id'),
    categoria: (_, { id }) => queryOne('SELECT * FROM categorias WHERE id = $1', [id]),

    productos: (_, { limite = 20, desde = 0, incluirInactivos = false }) =>
      query(
        `SELECT * FROM productos ${incluirInactivos ? '' : 'WHERE activo'} ORDER BY id LIMIT $1 OFFSET $2`,
        [limite, desde]
      ),
    producto: (_, { id }) => queryOne('SELECT * FROM productos WHERE id = $1', [id]),

    // Un CLIENTE solo ve sus propios pedidos; el equipo del panel los ve todos.
    pedidos: (_, { estado }, context) => {
      const usuario = requerirUsuario(context);
      const esEquipoPanel = usuario.rol === 'ADMIN' || usuario.rol === 'OPERADOR';

      if (esEquipoPanel) {
        const parametros = estado ? [estado] : [];
        const clausula = estado ? ' WHERE status = $1' : '';
        return query(`SELECT * FROM pedidos${clausula} ORDER BY id DESC`, parametros);
      }

      const parametros = estado ? [usuario.id, estado] : [usuario.id];
      const clausula = estado
        ? ' WHERE usuario_id = $1 AND status = $2'
        : ' WHERE usuario_id = $1';
      return query(`SELECT * FROM pedidos${clausula} ORDER BY id DESC`, parametros);
    },

    pedido: async (_, { id }, context) => {
      const usuario = requerirUsuario(context);
      return pedidoAutorizado(id, usuario);
    },

    estadisticasPanel: async (_, { limiteStock = 10, topeRecientes = 5 }, context) => {
      requerirPanel(context);
      const [ingresos, total, porEstado, stockBajo, recientes] = await Promise.all([
        queryOne(
          `SELECT COALESCE(SUM(total), 0) AS ingresos,
                  COALESCE(AVG(total), 0) AS ticket
             FROM pedidos
            WHERE status <> 'CANCELLED' AND estado_pago = 'APROBADO'`
        ),
        queryOne('SELECT COUNT(*)::int AS total FROM pedidos'),
        query('SELECT status AS estado, COUNT(*)::int AS cantidad FROM pedidos GROUP BY status ORDER BY estado'),
        // El umbral ahora es por producto (stock_minimo); el argumento
        // limiteStock se conserva en el esquema por compatibilidad.
        query(
          `SELECT * FROM productos
            WHERE activo AND stock <= stock_minimo
            ORDER BY stock ASC LIMIT $1`,
          [20]
        ),
        query('SELECT * FROM pedidos ORDER BY id DESC LIMIT $1', [topeRecientes]),
      ]);

      return {
        ingresosTotales: Number(ingresos.ingresos || 0),
        ticketPromedio: Number(ingresos.ticket || 0),
        totalPedidos: total.total,
        pedidosPorEstado: porEstado,
        stockBajo,
        pedidosRecientes: recientes,
      };
    },

    yo: (_, __, context) => {
      if (!context.usuario) return null;
      return queryOne('SELECT * FROM usuarios WHERE id = $1', [context.usuario.id]);
    },
  },

  Mutation: {
    // --- Gestion de productos (equipo del panel) ------------------------
    crearProducto: async (_, { datos }, context) => {
      requerirPanel(context);
      const validos = validarProductoInput(datos);
      try {
        return await queryOne(
          `INSERT INTO productos
             (nombre, precio, imagen, stock, categoria_id,
              costo_adquisicion, sku, stock_minimo, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            validos.nombre,
            validos.precio,
            validos.imagen ?? null,
            validos.stock,
            validos.categoriaId ?? null,
            validos.costoAdquisicion,
            validos.sku,
            validos.stockMinimo,
            validos.activo,
          ]
        );
      } catch (error) {
        throw errorSkuDuplicado(error);
      }
    },

    actualizarProducto: async (_, { id, datos }, context) => {
      requerirPanel(context);
      const validos = validarProductoInput(datos);
      const existente = await queryOne('SELECT * FROM productos WHERE id = $1', [id]);
      if (!existente) return null;
      try {
        const actualizado = await queryOne(
          `UPDATE productos
             SET nombre = $1, precio = $2, imagen = $3, stock = $4,
                 categoria_id = $5, costo_adquisicion = $6, sku = $7,
                 stock_minimo = $8, activo = $9
           WHERE id = $10
           RETURNING *`,
          [
            validos.nombre,
            validos.precio,
            validos.imagen ?? null,
            validos.stock,
            validos.categoriaId ?? null,
            validos.costoAdquisicion,
            validos.sku,
            validos.stockMinimo,
            validos.activo,
            id,
          ]
        );
        // Edicion directa desde el admin: avisamos a quien este suscrito.
        publicarStock(id);
        return actualizado;
      } catch (error) {
        throw errorSkuDuplicado(error);
      }
    },

    eliminarProducto: async (_, { id }, context) => {
      requerirPanel(context);
      // Baja logica: los movimientos de inventario y las ordenes de compra
      // referencian el producto, y un libro no se puede romper borrando.
      const rows = await query(
        'UPDATE productos SET activo = false WHERE id = $1 RETURNING id',
        [id]
      );
      return rows.length > 0;
    },

    // --- Pedidos ---------------------------------------------------------
    crearPedido: async (_, { datos }, context) => {
      const usuario = requerirUsuario(context);

      if (!datos.detalles || datos.detalles.length === 0) {
        throw new Error('El pedido necesita al menos un renglon (producto + cantidad).');
      }

      // La tasa viaja POR PEDIDO (0.16 por defecto; 0.08 en frontera; 0 para
      // exento). El desglose se congela en el pedido: si el IVA cambia en el
      // futuro, los pedidos viejos conservan el suyo.
      const tasa = datos.tasaImpuesto == null ? 0.16 : Number(datos.tasaImpuesto);
      if (!Number.isFinite(tasa) || tasa < 0 || tasa > 1) {
        throw new Error('La tasa de impuesto debe estar entre 0 y 1 (0.16 = 16%).');
      }
      const costoEnvio = Number(datos.costoEnvio || 0);
      if (!Number.isFinite(costoEnvio) || costoEnvio < 0) {
        throw new Error('El costo de envio debe ser un numero mayor o igual a cero.');
      }

      // Dentro de una transaccion real: se valida y DESCUENTA el stock (con
      // lock de fila para que dos compradores no vendan la ultima unidad a la
      // vez), se inserta el pedido con su desglose y sus renglones, y cada
      // salida de stock deja su movimiento en el libro de inventario.
      const pedidoId = await withTransaction(async (client) => {
        let subtotal = 0;
        const renglones = [];

        for (const r of datos.detalles) {
          const cantidad = Number(r.cantidad);
          if (!Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error('La cantidad debe ser un entero mayor a cero.');
          }
          const producto = await client.queryOne(
            'SELECT * FROM productos WHERE id = $1 FOR UPDATE',
            [r.productoId]
          );
          if (!producto) {
            throw new Error(`No existe un producto con id ${r.productoId}`);
          }
          if (producto.activo === false) {
            throw new Error(`"${producto.nombre}" ya no esta disponible en el catalogo.`);
          }
          if (producto.stock < cantidad) {
            throw new Error(
              `Stock insuficiente para "${producto.nombre}": quedan ${producto.stock} disponible(s).`
            );
          }
          subtotal += Number(producto.precio) * cantidad;
          renglones.push({
            productoId: producto.id,
            cantidad,
            precioUnitario: Number(producto.precio),
            // Snapshot del costo: el margen historico no cambia si despues
            // sube o baja el costo de adquisicion.
            costoUnitarioSnapshot: Number(producto.costo_adquisicion || 0),
          });
        }

        // Redondeo a centavos: el dinero no se maneja con floats "crudos".
        subtotal = Math.round(subtotal * 100) / 100;
        const impuestos = Math.round(subtotal * tasa * 100) / 100;
        const total = Math.round((subtotal + impuestos + costoEnvio) * 100) / 100;

        const pedido = await client.queryOne(
          `INSERT INTO pedidos
             (usuario_id, total, subtotal, impuestos, tasa_impuesto, costo_envio,
              status, metodo_pago, direccion_envio, ciudad, estado_geo,
              codigo_postal, telefono_contacto)
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            usuario.id,
            total,
            subtotal,
            impuestos,
            tasa,
            costoEnvio,
            datos.metodoPago ?? null,
            datos.direccionEnvio ?? null,
            datos.ciudad ?? null,
            datos.estadoGeo ?? null,
            datos.codigoPostal ?? null,
            datos.telefonoContacto ?? null,
          ]
        );

        for (const r of renglones) {
          await registrarMovimiento(client, {
            productoId: r.productoId,
            tipo: 'SALIDA',
            cantidad: r.cantidad,
            origen: 'PEDIDO',
            referenciaId: pedido.id,
            usuarioId: usuario.id,
            motivo: `Venta del pedido #${pedido.id}`,
          });
          await client.queryOne(
            `INSERT INTO detalle_pedido
               (pedido_id, producto_id, cantidad, precio_unitario, costo_unitario_snapshot)
             VALUES ($1, $2, $3, $4, $5)`,
            [pedido.id, r.productoId, r.cantidad, r.precioUnitario, r.costoUnitarioSnapshot]
          );
        }

        return pedido.id;
      });

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    actualizarEstadoPedido: async (_, { id, estado }, context) => {
      const usuario = requerirPanel(context);
      return withTransaction(async (client) => {
        const pedido = await client.queryOne(
          'SELECT * FROM pedidos WHERE id = $1 FOR UPDATE',
          [id]
        );
        if (!pedido) return null;

        const permitidos = TRANSICIONES[pedido.status] || [];
        if (!permitidos.includes(estado)) {
          throw new Error(
            `No se puede pasar un pedido de "${pedido.status}" a "${estado}".`
          );
        }

        await client.queryOne(`UPDATE pedidos SET status = $2 WHERE id = $1`, [id, estado]);

        // Bitacora: quien movio el pedido y cuando (el status actual sigue en
        // pedidos; esto es la trazabilidad).
        await client.queryOne(
          `INSERT INTO historial_estados_pedido
             (pedido_id, estado_anterior, estado_nuevo, usuario_id)
           VALUES ($1, $2, $3, $4)`,
          [id, pedido.status, estado, usuario.id]
        );

        if (estado === 'CANCELLED') {
          // Devolucion de stock por el mismo camino que todo lo demas: el
          // libro de inventario queda completo (ENTRADA con origen CANCELACION).
          const renglones = await client.query(
            'SELECT producto_id, cantidad FROM detalle_pedido WHERE pedido_id = $1',
            [id]
          );
          for (const r of renglones) {
            await registrarMovimiento(client, {
              productoId: r.producto_id,
              tipo: 'ENTRADA',
              cantidad: r.cantidad,
              origen: 'CANCELACION',
              referenciaId: id,
              usuarioId: usuario.id,
              motivo: `Cancelacion del pedido #${id}`,
            });
          }

          if (pedido.estado_pago === 'APROBADO') {
            // Un pedido pagado y cancelado deja asiento de reversa (nunca se
            // borra el asiento original).
            await revertirAsientosVenta(client, pedido, usuario.id);
          } else if (pedido.estado_pago === 'PENDIENTE') {
            await client.queryOne(
              `UPDATE pedidos SET estado_pago = 'CANCELADO' WHERE id = $1`,
              [id]
            );
          }
        }

        return client.queryOne('SELECT * FROM pedidos WHERE id = $1', [id]);
      });
    },

    // --- Autenticacion local ---------------------------------------------
    registrarse: async (_, { datos }) => {
      const nombre = (datos.nombre || '').trim();
      const email = (datos.email || '').trim().toLowerCase();
      if (!nombre) throw new Error('El nombre es obligatorio.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('El correo no tiene un formato valido.');
      }
      if (!datos.password || datos.password.length < 6) {
        throw new Error('La contrasena debe tener al menos 6 caracteres.');
      }

      const existente = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
      if (existente) {
        throw new Error('Ya existe una cuenta con ese correo.');
      }

      const usuario = await queryOne(
        `INSERT INTO usuarios (nombre, email, password, auth_provider, rol)
         VALUES ($1, $2, $3, 'LOCAL', 'CLIENTE')
         RETURNING *`,
        [nombre, email, await crearHash(datos.password)]
      );
      return { token: firmarToken(usuario), usuario };
    },

    iniciarSesion: async (_, { email, password }) => {
      const usuario = await queryOne(
        'SELECT * FROM usuarios WHERE email = $1',
        [(email || '').trim().toLowerCase()]
      );
      if (!usuario || !(await verificarPassword(password, usuario.password))) {
        throw new Error('Correo o contrasena incorrectos.');
      }
      return { token: firmarToken(usuario), usuario };
    },

    iniciarSesionGoogle: async (_, { idToken }) => {
      const datosGoogle = await verificarIdTokenGoogle(idToken);
      const usuario = await buscarOCrearUsuarioGoogle(datosGoogle);
      const token = firmarToken(usuario);
      return { token, usuario };
    },

    // --- Pasarelas de pago ----------------------------------------------
    procesarPagoMercadoPago: async (_, { pedidoId, datos }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no se puede pagar.');
      }
      if (pedido.estado_pago === 'APROBADO') {
        throw new Error('Este pedido ya esta pagado.');
      }

      // Checkout API (Checkout Transparente): el navegador ya tokenizo la
      // tarjeta con la Public Key; aqui se ejecuta el cobro real.
      let resultado;
      try {
        resultado = await crearPagoMercadoPago({
          pedidoId,
          monto: pedido.total,
          token: datos.token,
          paymentMethodId: datos.paymentMethodId,
          installments: datos.installments,
          issuerId: datos.issuerId,
          payerEmail: datos.payerEmail,
          descripcion: `Pedido #${pedidoId} - NexoPlay`,
        });
      } catch (err) {
        // Si la API rechazo la operacion (4xx/402) y trae un status_detail
        // conocido, mostramos el mensaje amigable en vez del error tecnico.
        if (err.statusDetail) {
          throw new Error(mensajeEstadoMercadoPago(err.statusDetail));
        }
        throw err;
      }

      // Se guarda el metodo y el id del cobro para poder consultarlo despues
      // (verificarPago lo usa por external_reference, no por referencia_pago).
      await queryOne(
        `UPDATE pedidos
            SET metodo_pago = 'MERCADO_PAGO',
                id_pago = $2
          WHERE id = $1`,
        [pedidoId, resultado.idPago ? String(resultado.idPago) : null]
      );

      if (resultado.estado === 'approved') {
        await marcarPagoAprobado(pedidoId, {
          metodoPago: 'MERCADO_PAGO',
          idPago: String(resultado.idPago),
        });
      } else if (resultado.estado === 'rejected' || resultado.estado === 'cancelled') {
        // El cobro quedo registrado como fallido en la BD y ademas se le
        // informa al cliente el motivo exacto (status_detail) para que pueda
        // reintentar sin salir del formulario de tarjeta.
        await marcarPagoFallido(pedidoId);
        throw new Error(mensajeEstadoMercadoPago(resultado.statusDetail));
      }
      // pending | in_process: se deja PENDIENTE y se confirma al volver a
      // /pago/resultado via verificarPago.

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    // OXXO: pago en efectivo en tienda. Se genera una ficha (ticket) que el
    // cliente paga en la tienda; el cobro queda PENDIENTE hasta que OXXO lo
    // confirme (webhook en produccion, verificarPago en desarrollo).
    procesarPagoOxxo: async (_, { pedidoId, datos }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no se puede pagar.');
      }
      if (pedido.estado_pago === 'APROBADO') {
        throw new Error('Este pedido ya esta pagado.');
      }

      const ticket = await crearPagoOxxo({
        pedidoId,
        monto: pedido.total,
        payerEmail: datos.payerEmail,
        descripcion: `Pedido #${pedidoId} - NexoPlay`,
      });

      // Se guarda la ficha (ticket_url) para poder reabrir la MISMA si el
      // cliente retoma el cobro; referencia_pago guarda la referencia OXXO.
      await queryOne(
        `UPDATE pedidos
            SET metodo_pago = 'OXXO',
                id_pago = $2,
                referencia_pago = $3,
                ticket_url = $4
          WHERE id = $1`,
        [
          pedidoId,
          ticket.idPago ? String(ticket.idPago) : null,
          ticket.referencia ? String(ticket.referencia) : null,
          ticket.urlTicket || null,
        ]
      );

      return {
        id: String(ticket.idPago),
        estado: 'PENDIENTE',
        url: ticket.urlTicket,
        referencia: ticket.referencia ? String(ticket.referencia) : null,
        expira: ticket.expira,
      };
    },

    iniciarPagoPayPal: async (_, { pedidoId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no se puede pagar.');
      }
      if (pedido.estado_pago === 'APROBADO') {
        throw new Error('Este pedido ya esta pagado.');
      }

      const orden = await crearOrdenPayPal({ pedidoId, total: pedido.total });

      await queryOne(
        `UPDATE pedidos
            SET metodo_pago = COALESCE(metodo_pago, 'PAYPAL'),
                referencia_pago = $2
          WHERE id = $1`,
        [pedidoId, orden.id]
      );

      return { id: orden.id, url: orden.url };
    },

    confirmarPagoPayPal: async (_, { pedidoId, orderId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));

      // El orderId lo manda el navegador al volver de PayPal; debe ser EXACTO
      // el de la orden creada para este pedido (referencia_pago). Sin esto un
      // cliente podria capturar una orden ajena y marcar como pagado un pedido
      // suyo que nunca pago.
      if (!pedido.referencia_pago || orderId !== pedido.referencia_pago) {
        throw new Error('La orden de PayPal no corresponde a este pedido.');
      }

      const captura = await capturarOrden(orderId);

      if (captura.estado === 'COMPLETED') {
        await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: captura.idPago });
      } else {
        await marcarPagoFallido(pedidoId);
      }

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    verificarPago: async (_, { pedidoId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.estado_pago !== 'PENDIENTE') {
        return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
      }

      // Mercado Pago y OXXO se consultan igual: por external_reference.
      if (pedido.metodo_pago === 'MERCADO_PAGO' || pedido.metodo_pago === 'OXXO') {
        const resultado = await consultarPagoPorReferencia(String(pedidoId));
        if (resultado.estado === 'approved') {
          await marcarPagoAprobado(pedidoId, {
            metodoPago: 'MERCADO_PAGO',
            idPago: resultado.idPago,
          });
        } else if (resultado.estado === 'rejected' || resultado.estado === 'cancelled') {
          await marcarPagoFallido(pedidoId);
        }
      } else if (pedido.metodo_pago === 'PAYPAL' && pedido.referencia_pago) {
        const orden = await consultarOrden(pedido.referencia_pago);
        if (orden.estado === 'COMPLETED') {
          await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: orden.id });
        } else if (orden.estado === 'APPROVED') {
          const captura = await capturarOrden(pedido.referencia_pago);
          if (captura.estado === 'COMPLETED') {
            await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: captura.idPago });
          }
        }
      }

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },
  },

  // --- Resolvers de campo (relaciones) ----------------------------------
  Categoria: {
    productos: (categoria) =>
      query('SELECT * FROM productos WHERE categoria_id = $1 ORDER BY id', [categoria.id]),
  },

  Subscription: {
    // Se dispara cada vez que cambia el stock de un producto (edicion en el
    // admin, compra, cancelacion, orden de compra o ajuste). Es publica: el
    // stock ya lo ve cualquiera en el catalogo.
    stockActualizado: {
      subscribe: (_, { productoId }) => escucharStock(productoId ?? null),
      resolve: (id) => queryOne('SELECT * FROM productos WHERE id = $1', [id]),
    },
  },

  Producto: {
    categoria: (producto) =>
      queryOne('SELECT * FROM categorias WHERE id = $1', [producto.categoria_id]),
  },

  Usuario: {
    avatarUrl: (usuario) => usuario.avatar_url,
    authProvider: (usuario) => usuario.auth_provider,
    pedidos: (usuario) =>
      query('SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY id', [usuario.id]),
  },

  Pedido: {
    usuario: (pedido) => queryOne('SELECT * FROM usuarios WHERE id = $1', [pedido.usuario_id]),
    detalles: (pedido) =>
      query('SELECT * FROM detalle_pedido WHERE pedido_id = $1 ORDER BY id', [pedido.id]),
    fecha: (pedido) => fechaHora(pedido.fecha),
    estadoPago: (pedido) => pedido.estado_pago,
    metodoPago: (pedido) => pedido.metodo_pago,
    referenciaPago: (pedido) => pedido.referencia_pago,
    idPago: (pedido) => pedido.id_pago,
    ticketUrl: (pedido) => pedido.ticket_url,
    fechaPago: (pedido) => fechaHora(pedido.fecha_pago),
  },

  DetallePedido: {
    producto: (detalle) =>
      queryOne('SELECT * FROM productos WHERE id = $1', [detalle.producto_id]),
    precioUnitario: (detalle) => Number(detalle.precio_unitario),
    subtotal: (detalle) => detalle.cantidad * Number(detalle.precio_unitario),
    costoUnitarioSnapshot: (detalle) =>
      detalle.costo_unitario_snapshot == null
        ? null
        : Number(detalle.costo_unitario_snapshot),
  },
};
// --- Combinacion de modulos del ERP -------------------------------------
// Cada modulo exporta mapas parciales ({ Query, Mutation, Tipo }). Se fusionan
// por clave: los resolvers de campo de varios modulos se suman (p. ej. Pedido
// recibe campos de finanzas y de logistica).
const modulosErp = [
  resolversInventario,
  resolversFinanzas,
  resolversLogistica,
  resolversCrm,
  resolversReportes,
];

function combinarResolvers(base, extras) {
  const salida = { ...base };
  for (const extra of extras) {
    for (const [tipo, mapa] of Object.entries(extra)) {
      salida[tipo] = { ...(salida[tipo] || {}), ...mapa };
    }
  }
  return salida;
}

export const resolvers = combinarResolvers(resolversBase, modulosErp);
