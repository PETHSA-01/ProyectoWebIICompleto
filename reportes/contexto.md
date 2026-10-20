# NexoPlay — Resumen y elementos destacables del código

**Práctica P2-6 · Programación Web II** — E-commerce de demostración (consolas, accesorios y videojuegos).

## 1. Descripción general

NexoPlay es una aplicación full-stack tipo tienda en línea de demostración:

- **Frontend**: React 19 + Vite (JavaScript, con diseño atómico y design tokens en CSS).
- **Backend**: Node.js + Apollo Server 5 (GraphQL) + SQLite (better-sqlite3, síncrono).
- **Base de datos**: SQLite embebida (`nexoplay.db`), auto-creada desde `db.sql` al arrancar.
| 13 | gitrenofyi@necub.com      | olatumamauwu   |                 1 | 2026-09-17 23:55:11
## 2. Estructura del proyecto

```
ProyectoWebIICompleto/
├── p26-back/                     Backend GraphQL + SQLite
│   ├── db.sql                    Esquema SQL + datos semilla (3 categorías, 8 productos, 2 usuarios)
│   ├── index.js                  Arranque del servidor Apollo Server
│   ├── README.md                 Instrucciones y ejemplos de queries/mutations
│   └── src/
│       ├── db.js                 Conexión better-sqlite3 + auto-inicialización desde db.sql
│       ├── schema.js             SDL de GraphQL: types, enums, inputs, Query, Mutation
│       └── resolvers.js          Resolvers + prepared statements + transacción crearPedido
└── p26-front/                    Frontend React + Vite — ELIMINADO en la rama AstroMongoYOAuth2.
                                 La estructura completa de archivos se conserva en GitHub:
                                 https://github.com/PETHSA-01/ProyectoWebIICompleto/tree/920d435/p26-front
```

## 3. Backend — elementos destacables

- **GraphQL tipado y documentado**: el schema (`schema.js`) usa SDL con docstrings `"""`, enums cerrados (`RolUsuario`, `EstadoPedido`) y 3 inputs para escrituras (`ProductoInput`, `DetallePedidoInput`, `PedidoInput`). Convención: queries sustantivo, mutations verbo+sustantivo.
- **Prepared statements** en todas las consultas (`stmts` en `resolvers.js`): protección contra inyección SQL.
- **Transacción atómica** en `crearPedido`: valida usuario y productos, calcula el total con precios actuales e inserta pedido + renglones *todo o nada* (`db.transaction()`).
- **Integridad referencial**: `PRAGMA foreign_keys = ON` y claves foráneas con `ON DELETE CASCADE` en `detalle_pedido`.
- **Auto-inicialización de la DB**: si `nexoplay.db` no existe (o `RESET_DB=true`), ejecuta `db.sql` completo con datos semilla de precios reales en MXN.
- **Field resolvers** para materializar relaciones (Categoria.productos, Pedido.detalles, etc.). Nota: genera el problema **N+1**, identificado y documentado (solución propuesta: DataLoader o joins).
- **CRUD completo de productos** vía mutations (`crearProducto`, `actualizarProducto`, `eliminarProducto`).

## 4. Frontend — elementos destacables

- **Máquina de estados finita (FSM)** con `useReducer` en lugar de React Router: estado `{pantalla, categoriaId, productoId}` con 12 eventos tipados y reductor **puro** (predecible y testeable). Los `dispatch` se envuelven en `useTransition` (React 19) para navegación no bloqueante.
- **Carrito con Context API** (`CarritoContext.jsx`): resuelve el *prop drilling*. `actualizarCantidad` hace **clamp entre 1 y stock** (nunca 0, nunca sobre inventario); totales memoizados con `useMemo`; `useCarrito()` lanza error si se usa fuera del provider.
- **Cliente GraphQL genérico** (`graphql/client.js`): una función `graphqlRequest(query, variables)` con fetch POST que valida `response.ok` y `errors[]`, y queries centralizadas en `QUERIES` (evita strings duplicados).
- **Skeletons animados con `aria-busy`** y componente `ErrorMessage` con botón "Reintentar" en todas las pantallas (estados de carga/error consistentes).
- **Checkout con validación *touched***: valida al hacer blur, no al escribir; usa `noValidate`, clases `error`, `aria-invalid` y `aria-describedby`. Al enviar dispara la mutation real `crearPedido` (usuario fijo `'2'`, login no obligatorio).
- **Diseño atómico (Brad Frost)**: átomos → moléculas → organismos → templates. Componentes de responsabilidad única (ej. `ProductoCard` no conoce routing, carrito ni GraphQL).
- **Design tokens** (`tokens.css`): variables centralizadas de color, tipografía y radios, reutilizadas en `index.css`.

## 5. Funcionalidades implementadas

- Catálogo paginado con "Cargar más" (límite 8, paginación por offset).
- Buscador por nombre (filtro cliente-side).
- Sidebar de categorías con contador de productos.
- Ficha de producto con selector de cantidad limitado por stock y manejo de "sin stock".
- Carrito: agregar, quitar con confirmación inline Sí/No, editar cantidades clampeadas.
- Checkout: formulario validado conectado a la mutation `crearPedido`.

## 6. Base de datos

5 tablas: `categorias`, `productos`, `usuarios`, `pedidos`, `detalle_pedido` (resuelve la relación N:M Pedido↔Producto con precio histórico). Con claves foráneas, `CHECK` (rol, estado) y datos semilla: 3 categorías, 8 productos y 2 usuarios.

## 7. Buenas prácticas, seguridad y pendientes

**Correcto**:
- Prepared statements anti-inyección SQL y transacciones atómicas.
- Sin exposición del campo `password` en el type `Usuario` del schema GraphQL.
- Accesibilidad: `aria-label`, `aria-invalid`, `aria-describedby`, `aria-busy`, `role="alert"`, clase `.visually-hidden`.
- Diseño responsive: `grid-template-columns: repeat(auto-fill, minmax(190px, 1fr))` y media queries que colapsan a 1 columna.
- Linter **oxlint** configurado y build de producción verificado (`dist/` generado).

**Pendientes / a mejorar** (documentados en el proyecto):
- Contraseñas simuladas en texto plano (`hashed:admin123`) — intencional para la práctica, no apto para producción.
- Las mutations de productos no verifican rol `ADMIN`.
- Sin validación de `stock >= cantidad` en `crearPedido`.
- CORS no configurado explícitamente (funciona en dev; en producción hay que definir origin).