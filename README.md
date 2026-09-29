# NexoPlay — Proyecto Final

Evolución de la práctica P2-6 hacia el stack pedido para el Proyecto Final:

- **PostgreSQL + PostgREST** en vez de SQLite (base de datos + API REST autogenerada)
- **OAuth2 con Google** en vez de login local con password
- **Astro + islas de React** en vez de una SPA completa de React

No se tocó nada de `p26-back/` ni `p26-front/` (las entregas ya calificadas de la práctica P2-6): todo esto vive en una carpeta nueva, `pf-nexoplay/`.

```
pf-nexoplay/
├── backend/              # GraphQL (Apollo) + Postgres + OAuth2 Google
│   ├── db/init.sql       # esquema Postgres + roles/RLS para PostgREST
│   ├── src/
│   │   ├── db.js         # pool de conexiones (pg)
│   │   ├── schema.js     # SDL, con SesionAuth / iniciarSesionGoogle / yo
│   │   ├── resolvers.js  # resolvers async con pg + reglas de autorización
│   │   └── auth/
│   │       ├── jwt.js      # firma/verifica el JWT propio (doble claim: rol + role)
│   │       ├── google.js   # verifica el ID token de Google, upsert de usuario
│   │       └── context.js  # arma el context de Apollo desde el header Authorization
│   ├── postgrest.conf    # configuración de PostgREST (roles, JWT, etc.)
│   └── docker-compose.yml# Postgres + PostgREST, para correr en tu máquina
└── frontend-astro/       # Home/Categoría/Producto en Astro (SSR) + islas React
    ├── src/pages/         # index.astro, categoria/[id].astro, producto/[id].astro, carrito.astro
    ├── src/components/    # islas: AgregarAlCarrito, CarritoResumen, CarritoCheckout, LoginGoogle
    └── src/stores/        # nanostores compartidos entre islas (carrito.js, sesion.js)
```

## Qué cambió respecto a P2-6 (y por qué)

| Antes (P2-6) | Ahora (Proyecto Final) |
|---|---|
| SQLite (`better-sqlite3`, síncrono) | PostgreSQL (`pg`, asíncrono) |
| Login no existía (usuarios fijos en la BD) | OAuth2 con Google, emite un JWT propio |
| `crearPedido` recibía `usuarioId` desde el cliente | `crearPedido` toma el usuario del JWT — nadie puede crear pedidos a nombre de otro |
| Solo GraphQL | GraphQL + PostgREST (API REST autogenerada desde el esquema de Postgres) |
| React SPA completa (Home/Categoría/Producto/Carrito/Checkout) | Astro para Home/Categoría/Producto (SSR); Carrito/Checkout/Login siguen siendo React, como "islas" hidratadas |

**Nota de diseño importante:** el mismo JWT que emite el backend autoriza dos sistemas distintos con vocabularios distintos:
- Trae `rol` (`ADMIN`/`CLIENTE`) para que los resolvers de GraphQL decidan qué permitir.
- Trae `role` (`web_admin`/`web_user`) para que **PostgREST** haga `SET ROLE` y Postgres aplique sus políticas de Row Level Security automáticamente.

Así, un solo login sirve tanto para pedirle datos a GraphQL como para pegarle directo a PostgREST (por ejemplo, desde otra app que solo necesite REST).

## Cómo probarlo

### 1. Base de datos

```bash
createdb nexoplay
psql -d nexoplay -f backend/db/init.sql
```

Esto crea las tablas, siembra el catálogo (los mismos 8 productos de P2-6) y crea los roles de Postgres que usa PostgREST (`authenticator`, `web_anon`, `web_user`, `web_admin`) con sus políticas de RLS.

**Ya se probó en este entorno**, corriendo contra una instancia real de Postgres 16: el script corre sin errores, los roles y políticas quedan creados correctamente (verificado con `\du` y `\d usuarios`), y se hicieron pruebas manuales de extremo a extremo (ver más abajo).

### 2. Backend GraphQL

```bash
cd backend
npm install
cp .env.example .env
# edita .env: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID
npm run dev
```

Se probó end-to-end en este entorno, con un usuario admin y uno cliente reales:
- Consultas públicas (`categorias`, `productos`) — **funcionan sin sesión**.
- `pedidos` y `crearPedido` sin token — **rechazados** ("Necesitas iniciar sesión").
- `crearPedido` con un JWT válido — el pedido se crea con el `usuario_id` tomado del token (no del input), y el total/subtotales se calculan correctamente contra Postgres real.
- Un CLIENTE solo ve sus propios pedidos en `pedidos`; un ADMIN los ve todos.
- Un CLIENTE que intenta `crearProducto` (mutación de solo-ADMIN) — **rechazado**.

`iniciarSesionGoogle` no se pudo probar con un login real de Google (necesita un Client ID real y un navegador), pero el flujo se probó firmando manualmente un JWT con la misma función (`firmarToken`) que usa ese resolver, así que la lógica de autorización que depende del JWT sí quedó verificada extremo a extremo.

### 3. PostgREST (⚠️ limitación de este entorno)

```bash
docker compose up -d
curl http://localhost:3000/productos
```

**Esto NO se pudo probar en vivo en este entorno**: el sandbox donde se preparó esta entrega bloquea la descarga de imágenes de Docker Hub y de GitHub Container Registry (ambos devuelven `403 Forbidden` al intentar `docker pull`), así que el contenedor de PostgREST nunca pudo arrancar aquí. `postgrest.conf` y `docker-compose.yml` están escritos siguiendo la documentación oficial de PostgREST y usan exactamente los mismos roles/contraseñas que `db/init.sql` crea (`authenticator` / `authenticator_pw_dev`), pero **debes verificarlo tú mismo en tu máquina** (ahí Docker Hub no está bloqueado). Pasos para verificar:

```bash
docker compose up -d
curl http://localhost:3000/productos                     # debería regresar el catálogo (rol web_anon)
curl http://localhost:3000/pedidos                        # sin token: debería regresar [] (RLS lo filtra)
curl http://localhost:3000/pedidos -H "Authorization: Bearer <JWT>"   # con token: pedidos del usuario
```

Si algo no coincide, lo primero que hay que revisar es que `jwt-secret` en `postgrest.conf` sea **idéntico** a `JWT_SECRET` en `backend/.env`.

### 4. Frontend Astro

```bash
cd frontend-astro
npm install
cp .env.example .env
npm run dev
```

Se probó en este entorno, sirviendo contra el backend real: Home, `/categoria/[id]` y `/producto/[id]` se renderizan en el servidor (Astro SSR) con datos reales del catálogo; el botón "Agregar al carrito" y el resumen del carrito en el encabezado son islas de React que comparten estado vía `nanostores` + `localStorage`; `npm run build` compila sin errores.

El login con Google y el checkout completo (que sí llaman a mutaciones reales) no se probaron con un Client ID real de Google en este entorno, pero comparten el mismo cliente GraphQL y la misma lógica de JWT que ya se verificó en el backend.

## Pendiente para la entrega final

- Conseguir un Google OAuth Client ID real (console.cloud.google.com) y probar el login completo en un navegador.
- Verificar PostgREST en una máquina sin la restricción de red de este sandbox (pasos arriba).
- Opcional: agregar DataLoader para resolver el N+1 de `Categoria.productos` (documentado también en `reporte-p6.md` de la práctica P2-6).
