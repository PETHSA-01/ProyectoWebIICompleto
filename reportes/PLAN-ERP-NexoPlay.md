# Plan ERP NexoPlay — 6 módulos nuevos del panel de administrador

**Proyecto:** NexoPlay — E-commerce (Proyecto Integrador de Desarrollo de Software I)
**Integrantes:** Betsabe Elizabeth Zamora Esqueda (22300935) · Saul Alexander Perez Gonzalez (23100128) · Grupo 8A1
**Institución:** CETI — Desarrollo de Software
**Fecha:** 20 de octubre de 2026

---

## 1. Punto de partida: qué existe HOY en el código

Antes de planear nada, esto es lo verificado en el repositorio (versión `PruebaWEBII-fix-mp-brick-contenedor.zip`):

### 1.1 El panel admin ya existe y funciona

| Pieza | Estado real |
|---|---|
| `frontend-astro/src/layouts/AdminLayout.astro` | ✅ Sidebar, breadcrumbs, tema claro/oscuro, avatar e iniciales |
| `frontend-astro/src/middleware.js` | ✅ Guard de rol: `/admin/*` exige `ADMIN` u `OPERADOR`, si no redirige a `/login` |
| `frontend-astro/src/pages/admin/index.astro` | ✅ Dashboard → isla `AdminDash.jsx` |
| `frontend-astro/src/pages/admin/productos.astro` | ✅ CRUD de productos → isla `AdminProductos.jsx` (drawer lateral) |
| `frontend-astro/src/pages/admin/ordenes.astro` | ✅ Órdenes → isla `AdminOrdenes.jsx` (filtro por pills + drawer) |
| `frontend-astro/src/styles/admin.css` | ✅ 483 líneas: sidebar, KPIs, tablas, badges, drawer, formularios, skeleton, responsive |

**Esto cambia todo el plan:** no hay que crear la infraestructura del panel — hay que **extenderla**. El patrón ya está establecido: *página `.astro` delgada que monta una isla React `.jsx`*, con el guard aplicado en el middleware.

### 1.2 Backend y modelo de datos actual

- **Roles:** `ADMIN`, `OPERADOR`, `CLIENTE` (enum `RolUsuario` + CHECK en `usuarios.rol`).
- **Helpers de autorización:** `requerirUsuario`, `requerirAdmin`, **`requerirPanel`** (`auth/context.js:48`) — este último es el que ya usa todo el panel.
- **Tablas (5):** `categorias`, `productos`, `usuarios`, `pedidos`, `detalle_pedido`.
- **Migraciones incrementales ya en uso:** `backend/db/migracion-cobros-dashboard.sql` y `migracion-oxxo.sql`. Patrón: `BEGIN;` + `ADD COLUMN IF NOT EXISTS` + `COMMIT;`, sin borrar nada. **Ya existe la cultura de migración — no hay que introducirla, solo continuarla.**
- **Pagos:** Mercado Pago (tarjeta + OXXO) y PayPal. `pedidos.estado_pago` ∈ `PENDIENTE/APROBADO/RECHAZADO/CANCELADO`, con `fecha_pago`, `id_pago`, `referencia_pago`.

### 1.3 Lo que ya está resuelto y NO hay que rehacer

Esto es importante porque tu enunciado lo pide como si faltara:

| Punto del enunciado | Estado |
|---|---|
| Estados del pedido (Recibido → Empaquetado → Enviado → Entregado) | ✅ **Ya existe.** `TRANSICIONES` en `resolvers.js:13` + `actualizarEstadoPedido` + UI completa en `AdminOrdenes.jsx`. Al cancelar devuelve stock (`devolverStock`). |
| Descuento de stock al vender | ✅ **Ya existe.** `crearPedido` usa `SELECT ... FOR UPDATE`, valida `stock < cantidad` y descuenta (`resolvers.js:161-187`). |
| Alerta de stock bajo | ✅ **Versión mínima existe.** `estadisticasPanel` devuelve `stockBajo` y `AdminDash.jsx` lo pinta. Lo que falta es el umbral configurable y la notificación. |
| Estado de pago separado del estado de envío | ✅ **Ya existe** (`estado_pago` vs `status`) — es justo la separación correcta para el área contable. |

**Lo que NO existe en absoluto:** proveedores, órdenes de compra, costo de adquisición, movimientos de inventario, movimientos contables, facturas, IVA desglosado, envíos/guías, direcciones de envío, historial de estados, perfil de cliente, tickets de soporte, reportes financieros.

### 1.4 Deuda técnica que este plan debe cerrar

| Hallazgo | Dónde | Por qué importa al ERP |
|---|---|---|
| `total` es plano: `Σ(precio × cantidad)` | `resolvers.js:181` | **No hay IVA.** Y el enunciado de tu propio proyecto (`PROYECTO.MD` §6 "Carrito") ya promete "resumen con subtotal, IVA y total". Hoy la promesa no se cumple en el backend. |
| No hay `costo` en productos | `init.sql:35` | Sin costo no existe **margen**, que es el punto 1 y 5 de tu enunciado. |
| `web_admin` con `FOR SELECT` solo en RLS | `init.sql:241-243` | Las escrituras del panel vía PostgREST afectan 0 filas en silencio. GraphQL no lo sufre (usa otro usuario de BD), pero hay que completarlo. |
| `postgrest.conf` con `jwt-secret` hardcodeado | `postgrest.conf:26` | Con finanzas en el sistema, un secreto filtrado permite firmar tokens `web_admin`. |
| Formato real de CFDI no implementado | — | Hay que declararlo con honestidad (ver §7). |

---

## 2. Convenciones que sigue todo el plan

Idénticas a las que ya usa el código, para que nada se sienta pegado:

1. **SQL parametrizado** (`$1, $2, …`), nunca interpolación.
2. **`RETURNING *`** en todo `INSERT`/`UPDATE`.
3. **`withTransaction(client)`** para operaciones de varios pasos.
4. **Autorización en el resolver** con `requerirPanel(context)` (o `requerirAdmin` si es exclusivo de admin) **y** GRANT/RLS en Postgres.
5. **Snapshots históricos:** todo renglón de venta u OC guarda el precio/costo **del momento**.
6. **Libros inmutables:** los movimientos (inventario y contables) se **agregan**, nunca se sobrescriben.
7. **Frontend:** página `.astro` delgada + isla React `client:load`. El panel **ya es 100% islas React** — no hay HTML SSR en las secciones del panel, así que las nuevas siguen ese patrón.
8. **CSS:** `styles/admin.css` + tokens (`--surface`, `--surface-2`, `--primary`, `--border`, `--text-muted`, `--radius-lg`, `--st-ok-bg`…). **Sin Tailwind, sin librerías de UI.**
9. **Migración por archivo** en `backend/db/migracion-<tema>.sql`, no destructiva.
10. **Documentos GraphQL** en `frontend-astro/src/lib/queries.js` (un solo archivo, plano, sin `import.meta.env`).

---

## 3. Módulo 0 — Cimientos (prerrequisito de los 5 módulos)

### 3.1 Migración base `migracion-erp.sql`

Un solo archivo, no destructivo, que agrega las columnas que varios módulos necesitan:

```sql
-- productos: costo, sku, umbral de alerta
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS costo_adquisicion NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo      INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sku               TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS activo            BOOLEAN NOT NULL DEFAULT true;

-- pedidos: desglose fiscal + dirección de envío
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS impuestos       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasa_impuesto   NUMERIC(5,4)  NOT NULL DEFAULT 0.16,
  ADD COLUMN IF NOT EXISTS costo_envio     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS direccion_envio TEXT,
  ADD COLUMN IF NOT EXISTS ciudad          TEXT,
  ADD COLUMN IF NOT EXISTS estado_geo      TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal   TEXT,
  ADD COLUMN IF NOT EXISTS telefono_contacto TEXT;

-- detalle_pedido: snapshot del costo para calcular margen histórico
ALTER TABLE detalle_pedido
  ADD COLUMN IF NOT EXISTS costo_unitario_snapshot NUMERIC(10,2);

-- Backfill: los pedidos existentes se marcan como históricos sin costo
UPDATE pedidos SET subtotal = total WHERE subtotal IS NULL;
```

**Mejora de RLS que entra aquí** (cierra el pendiente): policies `FOR ALL TO web_admin USING (true) WITH CHECK (true)` en todas las tablas + `ALTER DEFAULT PRIVILEGES` para que las tablas futuras hereden los GRANTs.

### 3.2 Carga inicial de rol: `requerirAdmin` vs `requerirPanel`

**Decisión de diseño importante.** Hay que separar dos niveles:

| Nivel | Helper | Módulos |
|---|---|---|
| Panel operativo (productos, OC, pedidos, envíos) | `requerirPanel` (ADMIN **u** OPERADOR) | 1, 3, 4 (parte) |
| Panel financiero (contabilidad, facturas, reportes, proveedores con condiciones de crédito) | `requerirAdmin` (**solo** ADMIN) | 2, 5, 4 (proveedores) |

**Por qué:** el rol `OPERADOR` existe para gestionar stock y pedidos; darle acceso a estados de resultados y facturación rompe la separación de funciones que justifica tener dos roles. Adicionalmente, el propio `context.js:46` ya documenta que "las operaciones exclusivas de dueño siguen exigiendo `requerirAdmin()`".

### 3.3 Helper de auditoría compartido

`backend/src/inventario/movimientos.js` con una función única que todos los flujos usan para mover stock:

```
registrarMovimiento(client, { productoId, tipo, cantidad, origen, referenciaId, usuarioId, motivo })
```

Que hace, **dentro de la transacción del llamador**: inserta en `movimientos_inventario` y actualiza `productos.stock` en un solo paso. Así el stock nunca se actualiza "a mano" en distintos resolvers (que es como se desincroniza un inventario).

**Migración de los flujos existentes:** `crearPedido` y `devolverStock` (`pagos/estado-pedido.js:53`) deben pasar a usar esta función, para que desde el día uno el libro de inventario sea completo y no haya movimientos invisibles.

---

## 4. Módulo 1 — Inventarios y Almacén (Compras / Stock)

> *"Órdenes de Compra · Costo de Adquisición · Alertas de Stock Mínimo"*

### 4.1 Modelo de datos

| Tabla nueva | Columnas |
|---|---|
| `proveedores` | `id`, `nombre`, `contacto`, `email`, `telefono`, `marcas_distribuidas`, `condiciones_pago` (`CONTADO/CREDITO_30/CREDITO_60`), `dias_credito`, `notas`, `activo` |
| `ordenes_compra` | `id`, `proveedor_id`, `fecha`, `estado` (`BORRADOR/RECIBIDA/CANCELADA`), `subtotal`, `impuestos`, `total`, `recibida_en`, `usuario_id` |
| `detalle_oc` | `id`, `oc_id`, `producto_id`, `cantidad`, `costo_unitario` |
| `movimientos_inventario` | `id`, `producto_id`, `tipo` (`ENTRADA/SALIDA/AJUSTE`), `cantidad`, `origen` (`OC/PEDIDO/AJUSTE_MANUAL/CANCELACION`), `referencia_id`, `motivo`, `usuario_id`, `fecha` |

Relaciones: `proveedores 1—N ordenes_compra`; `ordenes_compra 1—N detalle_oc`; `ordenes_compra N—N productos` (vía `detalle_oc`, con `costo_unitario`) — **el mismo patrón N-N que `detalle_pedido`**, que ya usas y ya sabes defender.

**"Costo de Adquisición":** vive en `productos.costo_adquisicion` (1:1 con el producto) y su **histórico** en `detalle_oc.costo_unitario`. Al recibir una OC, el costo del producto se actualiza al último costo recibido.

**Ejemplo real de tu enunciado:** Xbox Series X con precio de venta $11,499.00 y costo $9,800.00 → margen = `(11499 − 9800) / 11499` = **14.8 %**. Ese cálculo es un resolver de campo `Producto.margen`, no un campo almacenado (así nunca queda desactualizado).

### 4.2 Backend GraphQL

**Types:** `Proveedor`, `OrdenCompra`, `DetalleOC`, `MovimientoInventario`; enum `EstadoOC`.
**Campos nuevos en `Producto`:** `costoAdquisicion`, `margen`, `sku`, `stockMinimo`, `bajoMinimo`, `activo`.
**Queries:** `proveedores`, `proveedor(id)`, `ordenesCompra(estado)`, `ordenCompra(id)`, `movimientosInventario(productoId, tipo)`, `productosBajoMinimo`.
**Mutations** (con `requerirPanel`, salvo proveedores que van con `requerirAdmin`):
- `crearOrdenCompra(proveedorId, renglones)` → `BORRADOR`, calcula totales.
- **`recibirOrdenCompra(id)`** — la mutación central, en una transacción: por cada renglón llama a `registrarMovimiento` con `tipo=ENTRADA, origen=OC`, actualiza `productos.costo_adquisicion`, marca la OC `RECIBIDA`.
- `cancelarOrdenCompra(id)` (solo desde `BORRADOR`).
- `ajustarStock(productoId, cantidad, motivo)` → `AJUSTE` con **motivo obligatorio** (merma, robo, conteo físico).
- `actualizarUmbralStock(productoId, stockMinimo)`.

**Corrección de `crearPedido`:** agregar `costo_unitario_snapshot` al renglón y escribir un `SALIDA` con `origen=PEDIDO`.

### 4.3 Frontend

Nuevas entradas en `AdminLayout.astro` (el array `articulos` está en la línea 14 — hay que ampliarlo):

| Ruta | Contenido |
|---|---|
| `/admin/inventario` | Tabla con **Stock / Mínimo / Costo / Precio / Margen %**, fila resaltada cuando `stock <= stock_minimo`. Isla `AdminInventario.jsx`. |
| `/admin/compras` | Lista de OC con filtro por estado. Isla `AdminCompras.jsx`. |
| `/admin/compras/nueva` | Formulario multi-renglón (o drawer sobre la lista, siguiendo el patrón existente). |

**Alertas de Stock Mínimo.** Aquí hay que ser preciso sobre lo que ya hay y lo que falta:
- Ya existe: `estadisticasPanel.stockBajo` + tarjeta en `AdminDash.jsx` con umbral fijo `≤ 5`.
- Lo que se agrega: (a) umbral **por producto** (`stock_minimo`), (b) query `productosBajoMinimo` que respeta el umbral propio, (c) **badge en el sidebar** con el conteo — visible desde cualquier sección del panel, sin tener que entrar al dashboard, (d) marcado del producto como `agotado` derivado de `stock = 0` (se mantiene la derivación, ahora con datos auditables detrás).

---

## 5. Módulo 2 — Ventas y Facturación (Financiero)

> *"Registro de Transacciones · Módulo de Facturación · Cálculo de Impuestos"*

### 5.1 Cálculo de impuestos (y una decisión que hay que tomar)

`crearPedido` pasa a calcular:

```
subtotal  = Σ(precio_unitario × cantidad)
impuestos = subtotal × tasa_impuesto          -- 0.16 por defecto
total     = subtotal + impuestos + costo_envio
```

**Decisión crítica de migración:** los pedidos existentes tienen `total` calculado **sin IVA**. Al introducir el desglose, hay tres caminos:

| Opción | Efecto | Recomendación |
|---|---|---|
| **A.** `subtotal = total` viejo, `impuestos = 0` | No altera lo ya cobrado; el histórico queda como "sin IVA registrado" | ✅ **Recomendada** — respeta los cobros reales ya hechos en Mercado Pago/PayPal |
| B. Recalcular hacia atrás (`subtotal = total / 1.16`) | Cambia la interpretación de dinero ya cobrado | ❌ Riesgo contable |
| C. Aplicar solo a pedidos nuevos | Igual que A, pero explícito | Equivalente a A |

Un pedido ya cobrado **no se reinterpreta**. Los reportes del Módulo 5 deben tratar esos pedidos históricos explícitamente (ver §8).

### 5.2 Registro de transacciones (asiento contable automático)

**Tabla `movimientos_contables`:** `id`, `fecha`, `tipo` (`INGRESO/EGRESO`), `cuenta` (`CAJA/BANCO/INVENTARIO/COSTO_VENTAS/IVA_TRASLADADO`), `monto`, `concepto`, `origen` (`PEDIDO/OC/AJUSTE`), `referencia_id`, `usuario_id`.

**El disparador es `estado_pago → APROBADO`**, no la creación del pedido. Es la decisión correcta: un pedido en `PENDIENTE` que nunca se paga no es un ingreso (y hoy mismo el dashboard ya usa `estado_pago = 'APROBADO'` para calcular ingresos — `resolvers.js:88`).

**Punto de integración:** `marcarPagoAprobado()` en `backend/src/pagos/estado-pedido.js:13`, que **ya es una transacción**. Se le agrega la escritura de los asientos dentro de esa misma transacción:

| Cuenta | Tipo | Monto | Significado (partida doble) |
|---|---|---|---|
| `CAJA` / `BANCO` | `INGRESO` | `total` | Entra el dinero |
| `INVENTARIO` | `EGRESO` | `Σ(costo_snapshot × cantidad)` | Sale la mercancía |
| `COSTO_VENTAS` | `INGRESO` | `Σ(costo_snapshot × cantidad)` | Contrapartida del costo |
| `IVA_TRASLADADO` | `INGRESO` | `impuestos` | Impuesto a enterar |

Nota: `CAJA` vs `BANCO` se decide por `metodo_pago` — OXXO y tarjeta entran a `BANCO`; un pago en efectivo en tienda iría a `CAJA`. **Guardar la cuenta mejora la utilidad del reporte** y es trivial de implementar aquí.

Importante: los asientos se escriben **una sola vez**. `marcarPagoAprobado` ya se protege de reejecutarse (solo confirma si `status = 'PENDING'`), pero hay que agregar una guarda explícita: si ya existe un movimiento con `origen=PEDIDO` y `referencia_id=<pedidoId>`, no volver a insertarlo.

### 5.3 Módulo de facturación

**Tabla `facturas`:** `id`, `pedido_id` (UNIQUE), `serie`, `folio`, `rfc`, `razon_social`, `regimen_fiscal`, `uso_cfdi`, `codigo_postal_fiscal`, `subtotal`, `impuestos`, `total`, `estado` (`BORRADOR/EMITIDA/CANCELADA`), `uuid_fiscal`, `emitida_en`.

**Mutations:** `emitirFactura(pedidoId, datosFiscales)` (valida formato de RFC, asigna folio desde una secuencia, congela el desglose), `cancelarFactura(id)`.
**UI:** checklist "Solicitar factura" en el drawer de orden + sección `/admin/facturacion` con las facturas emitidas.

> **Límite declarado, no disimulado.** El **timbrado real** de un CFDI exige un PAC (Proveedor Autorizado de Certificación) con contrato, CSD y costo por documento. Lo que este módulo entrega y es evaluable: la **estructura CFDI 4.0 completa** (emisor, receptor con régimen y uso, desglose de IVA, serie/folio, moneda, forma de pago) y el campo `uuid_fiscal` listo para recibir el timbre. El adaptador a un PAC se deja como punto de extensión documentado. **No se va a simular un timbre falso.**

### 5.4 UI de ventas

`/admin/ventas` → tabla con **Subtotal / IVA / Total / Estado de pago / Método / Margen**, y detalle con los asientos contables generados. Isla `AdminVentas.jsx`.

**Cambio en la tienda:** `CarritoCheckout.jsx` debe mostrar *Subtotal / IVA (16 %) / Envío / Total* en vez del total plano. Esto **cumple una promesa que tu propio `PROYECTO.MD` §6 ya hace** ("resumen automático de subtotal, IVA y total") y que hoy el backend no respalda.

---

## 6. Módulo 3 — Logística y Envíos

> *"Gestión de Guías · Estados del Pedido"*

### 6.1 Lo que ya está y lo que falta

El flujo **Pedido Recibido → Empaquetado → Enviado → Entregado** ya está implementado, con validación de transiciones (`TRANSICIONES` en `resolvers.js:13`) y UI (`AdminOrdenes.jsx`). Lo que falta **no son los estados, es la logística alrededor**:

| Falta | Solución |
|---|---|
| Dirección de envío | Columnas en `pedidos` (Módulo 0) o tabla `direcciones_envio` |
| Guías y paqueterías | Tabla `envios` + adaptador |
| Bitácora de estados (quién y cuándo) | Tabla `historial_estados_pedido` |
| Costo de envío en el total | `pedidos.costo_envio` (Módulo 0) |
| Vista tipo kanban para almacén | Tablero en `/admin/envios` |

### 6.2 Modelo de datos

| Tabla | Columnas |
|---|---|
| `envios` | `id`, `pedido_id` (UNIQUE), `paqueteria` (`DHL/ESTAFETA/FEDEX/SIMULADA`), `numero_guia`, `url_rastreo`, `costo_envio`, `fecha_creacion`, `fecha_entrega_estimada`, `entregado_en` |
| `historial_estados_pedido` | `id`, `pedido_id`, `estado_anterior`, `estado_nuevo`, `comentario`, `usuario_id`, `fecha` |

**Por qué el historial y no solo `pedidos.status`:** la columna guarda el estado *actual* (rápido de consultar, ya funciona en toda la UI). El historial guarda **cuándo y quién** movió el pedido — necesario para medir tiempos de empaquetado, reclamar a la paquetería y auditar. Se escribe desde `actualizarEstadoPedido`, en su misma transacción.

### 6.3 Adaptador de paqueterías

`backend/src/envios/paqueterias.js` con un contrato único:

```
crearGuia({ pedido, direccion, paqueteria, paquete }) → { numeroGuia, urlRastreo, etiquetaUrl }
```

con una implementación por paquetería. **Decisión de alcance:** las APIs de DHL, Estafeta y FedEx exigen contrato comercial y credenciales que este proyecto no tiene. Se implementa:
1. Un proveedor `SIMULADA` que genera guías con el **formato real** de folio de cada paquetería → todo el flujo se demuestra de punta a punta.
2. Los adaptadores reales escritos contra la interfaz, con credenciales en `.env` (`DHL_API_KEY`, `ESTAFETA_API_KEY`, `FEDEX_API_KEY`), listos para activar.

**Mutations:** `crearGuia(pedidoId, paqueteria, paquete)`, `marcarEntregado(pedidoId)` (→ `DELIVERED` + `entregado_en`).

### 6.4 Frontend

- `/admin/envios` → **tablero kanban** con una columna por estado; tarjeta = folio, cliente, días en ese estado. Isla `TableroEnvios.jsx`. Al hacer clic en "Enviado" se abre el drawer para generar la guía.
- **Portal del cliente:** `mis-ordenes.astro` (ya existe) se amplía con número de guía y enlace de rastreo. La línea de tiempo de estados ya está prometida en `PROYECTO.MD` §6.

---

## 7. Módulo 4 — Clientes y Proveedores (CRM / BRM)

> *"Historial de Clientes · Directorio de Proveedores"*

### 7.1 Historial de clientes: es agregación, no tablas nuevas

**Decisión importante:** el perfil de cliente **no requiere modelo nuevo** (salvo tickets). Se construye con `GROUP BY` en SQL sobre `pedidos`, `detalle_pedido` y `productos`, que ya existen.

**Type `PerfilCliente`:** `usuario`, `totalPedidos`, `totalGastado`, `ticketPromedio`, `primeraCompra`, `ultimaCompra`, `categoriaFavorita`, `productosMasComprados: [ConteoProducto]`, `ticketsAbiertos`.

**Nota de rendimiento:** cada agregado es **una sola query con `GROUP BY`**, nunca un bucle en JS sobre los pedidos del cliente. Es exactamente la lección N+1 ya documentada en `reportes/reporte-p6.md`.

**Tabla nueva (la única):** `tickets_soporte` — `id`, `usuario_id`, `pedido_id` (nullable), `asunto`, `descripcion`, `estado` (`ABIERTO/EN_PROCESO/CERRADO`), `prioridad`, `creado_en`, `cerrado_en`.

### 7.2 Directorio de proveedores

La tabla `proveedores` del Módulo 1 **se reutiliza** (no se duplica). Aquí se le agregan las vistas de BRM: datos de contacto, marcas distribuidas, condiciones de pago (`CREDITO_30`), **historial de órdenes de compra** y **saldo pendiente** (Σ de OC recibidas con crédito menos pagos — útil y honesto de calcular sobre `ordenes_compra`).

### 7.3 Backend y frontend

**Queries:** `clientes(busqueda)`, `perfilCliente(usuarioId)`, `ticketsSoporte(usuarioId)`, `proveedor(id)` con su historial.
**Mutations:** `crearTicket`, `cambiarEstadoTicket`, `actualizarProveedor` (esta con `requerirAdmin`).
**UI:**
- `/admin/clientes` → tabla buscable (nombre, email, # pedidos, total gastado, última compra, tickets abiertos). Isla `AdminClientes.jsx`.
- `/admin/clientes/[id]` → perfil con consumo por categoría y timeline.
- `/admin/proveedores` → directorio + historial de compras + condiciones.

---

## 8. Módulo 5 — Reportes Financieros y Dashboard

> *"Estado de Resultados · Rotación de Inventario"*

### 8.1 Backend: dos queries contables, en SQL

**`estadoResultados(desde, hasta)`** → `ingresos` (Σ `subtotal` de pedidos con `estado_pago='APROBADO'`), `costoVentas` (Σ `costo_unitario_snapshot × cantidad`), `utilidadBruta`, `margenPorcentaje`, `ivaTrasladado`, y la **serie mensual** `[{ mes, ingresos, costoVentas, utilidad }]` para la gráfica.

> **Nota contable que hay que documentar en el reporte:** el **IVA no es ingreso**. Es un impuesto que se traslada al SAT. Por eso el estado de resultados se calcula sobre `subtotal` y el IVA se reporta **aparte**. Calcular "ingresos" sobre `total` infla la utilidad y es el error clásico de un ERP casero.

**`rotacionInventario(desde, hasta)`** → por producto y categoría: `unidadesVendidas`, `ingresos`, `costo`, `utilidad`, `vecesRotado` (`unidadesVendidas / stockPromedio`), `diasInventario`, `bajaRotacion`.

Esta query **responde directamente tu pregunta** — ¿qué se vende más rápido, videojuegos o consolas? — con datos y no con intuición: agrupando por `categorias.nombre`.

**`resumenDashboard`** → los KPIs de portada en **una sola** llamada, para no encadenar 5 requests.

### 8.2 Frontend

- `/admin/reportes` → estado de resultados con filtro de periodo + rotación por categoría. Isla `AdminReportes.jsx`.
- **Gráficas en SVG inline**, sin Chart.js. Las series ya vienen agregadas del backend; para barras y líneas simples una librería es peso muerto y rompería la filosofía de islas mínimas del proyecto. Los componentes `Iconos.jsx` (SVG inline, sin dependencias) ya marcan el precedente.
- **Exportar CSV** desde una ruta `admin/reportes/exportar.csv.js` que reutiliza la misma query.
- **KPIs nuevos en `AdminDash.jsx`** (que ya existe): utilidad del mes, margen, productos bajo mínimo, pedidos por atender. Se conserva lo que ya muestra y se agrega, sin reescribir el componente.

---

## 9. Orden de ejecución

Cada fase deja el panel **funcionando y usable**.

| Fase | Contenido | Entregable verificable |
|---|---|---|
| **F0** | Migración base, `registrarMovimiento`, split `requerirPanel`/`requerirAdmin`, RLS completa, secretos a `.env` | El panel sigue funcionando igual; las tablas nuevas existen |
| **F1** | Módulo 1: proveedores, OC, recepción, costo, margen, umbral de stock | Crear OC → recibir → stock sube, costo se actualiza y queda auditado |
| **F2** | Módulo 2: IVA, desglose, `costo_snapshot`, asientos contables, facturas | Una venta aprobada genera asientos; se emite una factura |
| **F3** | Módulo 3: envíos, historial de estados, tablero kanban, guía en mis-ordenes | Pedido recorre los 4 estados con bitácora y guía |
| **F4** | Módulo 4: perfil de cliente, tickets, directorio de proveedores | Perfil con totales y hábitos correctos |
| **F5** | Módulo 5: estado de resultados, rotación, dashboard, CSV | Reportes con datos reales de las fases anteriores |

**Dependencias:** F0 bloquea todo. F2 depende de F1 (sin costo no hay margen ni asiento de inventario). F5 depende de F1+F2 (sin costos ni asientos no hay estado de resultados). F3 y F4 son independientes entre sí.

---

## 10. Riesgos y decisiones abiertas

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Pedidos históricos sin IVA ni costo snapshot** | Reportes que mezclan dos regímenes | `costo_unitario_snapshot` NULL → esos renglones se excluyen del cálculo de margen, con nota visible. `subtotal = total` viejo para no reinterpretar cobros. |
| **Timbrado CFDI real** | Sin PAC no hay factura fiscalmente válida | Se entrega la estructura CFDI 4.0 + campo `uuid_fiscal`; el adaptador al PAC queda como extensión documentada. **No se simula un timbre.** |
| **APIs de paqueterías sin contrato** | Sin credenciales no hay guías reales | Interfaz única + proveedor simulado con formato real + adaptadores listos. |
| **Duplicar asientos contables** | Utilidad inflada | Guarda de idempotencia por `(origen, referencia_id)` en `movimientos_contables`. |
| **`marcarPagoAprobado` se llama desde 4 flujos distintos** (MP, OXXO, PayPal, `verificarPago`) | Riesgo de asiento duplicado o faltante | Los asientos se escriben **dentro de esa única función**, no en cada flujo. Es el único punto de verdad. |
| **`devolverStock` al cancelar no revierte el asiento contable** | Contabilidad desalineada | Al cancelar un pedido pagado se escribe un movimiento de **reversa** (`origen=CANCELACION`), no un borrado. |
| **`ADMIN` y `OPERADOR` viendo finanzas** | Rompe separación de funciones | Reportes y facturación con `requerirAdmin` (solo ADMIN). |

### Preguntas para cerrar antes de F0

1. **¿IVA fijo 16 % o multi-tasa?** El plan asume `tasa_impuesto` por pedido con default 16 %, que cubre también 8 % de frontera y exento sin trabajo extra. ¿Confirmas?
2. **¿Un solo almacén o inventario por ubicación?** Asumido: almacén único (`productos.stock`). Multi-almacén exigiría tabla `almacenes` + `stock_por_almacen` y cambia F1.
3. **¿La cancelación de un pedido ya pagado debe generar asiento de reversa automático**, o eso se queda como ajuste manual del contador? El plan asume **automático**.
4. **¿Los pedidos históricos (previos a F2) entran en el estado de resultados?** El plan los incluye en ingresos pero los excluye del margen (no tienen costo), señalándolo explícitamente en el reporte.

---

## 11. Archivos afectados (resumen)

**Nuevos — backend:** `db/migracion-erp.sql`, `src/inventario/movimientos.js`, `src/envios/paqueterias.js`, `src/contabilidad/asientos.js`.
**Nuevos — frontend:** `pages/admin/{inventario,compras,ventas,envios,clientes,proveedores,reportes}.astro`, componentes `AdminInventario.jsx`, `AdminCompras.jsx`, `AdminVentas.jsx`, `TableroEnvios.jsx`, `AdminClientes.jsx`, `AdminProveedores.jsx`, `AdminReportes.jsx`, y `Grafica.jsx` (SVG).
**Modificados:** `backend/src/schema.js`, `backend/src/resolvers.js` (IVA, snapshot, snapshot de costo), `backend/src/pagos/estado-pedido.js` (asientos + usar `registrarMovimiento`), `frontend-astro/src/layouts/AdminLayout.astro` (nuevos ítems del sidebar + badge de alertas), `frontend-astro/src/lib/queries.js`, `frontend-astro/src/lib/formatos.js` (formato de margen/porcentaje), `frontend-astro/src/components/AdminDash.jsx` (KPIs nuevos), `frontend-astro/src/components/CarritoCheckout.jsx` (desglose de IVA), `frontend-astro/src/pages/mis-ordenes.astro` (guía de rastreo), `frontend-astro/src/styles/admin.css` (kanban, gráficas, margen), `frontend-astro/src/components/Iconos.jsx` (íconos de los módulos nuevos), `backend/postgrest.conf` (secreto a `.env`).
