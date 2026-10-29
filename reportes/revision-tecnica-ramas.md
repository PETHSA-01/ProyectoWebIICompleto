# Revisión técnica de ramas — Proyecto Web II / NexoPlay

> Revisión de código de las dos ramas del repositorio: la rama antigua `main`
> (práctica P2-6) y la rama actual `Astro+Mongo` (proyecto final).
> Análisis estático y verificación puntual de hipótesis. **No se modificó código fuente.**

- **Fecha:** 29 de septiembre de 2026
- **Repositorio:** `PETHSA-01/ProyectoWebIICompleto`
- **Alcance:** 4 componentes, 33 archivos fuente
- **Método:** lectura estática + verificación empírica de hipótesis críticas (sondas en `/tmp`, limpiadas después)
- **Rama analizada:** `Astro+Mongo` (HEAD) con comparación contra `main`

---

## 1. Resumen ejecutivo

El repositorio contiene **dos implementaciones distintas de la misma tienda**, no dos
versiones evolucionadas de la misma. La rama `main` implementa la práctica P2-6 con
React + Vite y Apollo + SQLite. La rama `Astro+Mongo` la reescribe con Astro + islands
y Apollo + PostgreSQL + PostgREST, añadiendo autenticación real con Google OAuth.

**La reescritura mejoró lo más importante (autenticación) y empeoró lo más sutil
(la capa de permisos de base de datos).**

| Severidad | `p26-back` | `p26-front` | `backend/` | `frontend-astro/` | **Total** |
|---|---|---|---|---|---|
| 🔴 CRÍTICO | 3 | 2 | 4 | 3 | **12** |
| 🟠 ALTO | 7 | 9 | 8 | 6 | **30** |
| 🟡 MEDIO | 12 | 17 | 19 | ~10 | **58** |
| 🔵 BAJO | 10 | ~20 | 9 | ~10 | **~49** |
| | **32** | **~48** | **40** | **~29** | **~149** |

### 1.1 Veredicto por componente

| Componente | Arquitectura | Corrección | Seguridad | Accesibilidad | Deps | Global |
|---|---|---|---|---|---|---|
| `p26-back` (antigua) | 7/10 | 5/10 | **2/10** | n/a | 7/10 | 4/10 |
| `p26-front` (antigua) | 7/10 | **3/10** | 8/10 | 6/10 | 8/10 | 5/10 |
| `backend/` (nueva) | 6/10 | 4/10 | **2/10** | n/a | 7/10 | **3/10** |
| `frontend-astro/` (nueva) | **8/10** | **4/10** | 4/10 | **3/10** | 5/10 | 4/10 |

### 1.2 Los 12 hallazgos críticos

**Rama antigua — `p26-back`**

| # | Hallazgo | Evidencia |
|---|---|---|
| A-1 | Sin autenticación ni autorización. `crearPedido` acepta el `usuarioId` del cliente → IDOR + escalada a ADMIN trivial. El campo `rol` existe en el schema y **nunca se lee**. | `p26-back/src/resolvers.js:86`, `src/schema.js:80-87` |
| A-2 | Sin límite de profundidad GraphQL. Ciclo `Categoria.productos ↔ Producto.categoria` + `Query.pedidos` sin paginar → amplificación algorítmica / DoS. | `p26-back/src/schema.js:22,33`, `resolvers.js:51` |
| A-3 | `.gitignore` raíz vacío (0 bytes) → ventana de fuga de secretos. | `.gitignore` |

**Rama antigua — `p26-front`**

| # | Hallazgo | Evidencia |
|---|---|---|
| B-1 | El botón "Volver a {categoría}" está **roto en el 100 % de los productos abiertos desde el Home**: `verProducto` no setea `categoriaId` → el "volver" consulta `categoria(id: null)` y entra en un loop de error irrecuperable. | `p26-front/src/App.jsx:27-28, 39-40` |
| B-2 | Carrera entre `vaciarCarrito()` y `onPedidoCreado()` en el checkout. Si el commit del Context se descarta, el carrito queda "pagado" pero intacto, y un segundo clic crea un **segundo pedido idéntico**. | `p26-front/src/templates/Checkout.jsx:85-92` |

**Rama nueva — `backend/`**

| # | Hallazgo | Evidencia |
|---|---|---|
| C-1 | `jwt-secret` de PostgREST **hardcodeado en un archivo versionado**, con un valor **idéntico al placeholder** de `.env.example`. Cualquiera firma su propio JWT con `role: web_admin` y obtiene control total de la base. | `backend/postgrest.conf:26` vs `backend/.env.example:8` |
| C-2 | Escalada `CLIENTE → ADMIN` vía `PATCH /usuarios` con `{"rol":"ADMIN"}`. RLS filtra por **fila**, nunca por **columna**; hay `GRANT UPDATE ON usuarios` sin `REVOKE` por columna. | `backend/db/init.sql:164, 215-218` |
| C-3 | `GRANT INSERT ON pedidos, detalle_pedido TO web_user` permite saltarse `crearPedido` por completo y crear pedidos con `total: -500` y `status: "DELIVERED"`. La RLS comprueba **quién** es el pedido, nunca **cuánto** vale. | `backend/db/init.sql:163, 191-194` |
| C-4 | `crearPedido` **no valida stock, no lo descuenta**, y acepta `cantidad` negativa → `total` negativo. El frontend tampoco protege. | `backend/src/resolvers.js:99-115` |

**Rama nueva — `frontend-astro/`**

| # | Hallazgo | Evidencia |
|---|---|---|
| D-1 | JWT persistido en `localStorage`, con 7 días de vida y claim `rol`, y es **el mismo token que PostgREST acepta** para hacer `SET ROLE`. Cualquier XSS o extensión lo roba. | `frontend-astro/src/stores/sesion.js:7-14`, `backend/db/init.sql:115-126` |
| D-2 | `decode: JSON.parse` sin `try/catch` ni validación de forma. Un `localStorage` corrupto (o una escritura parcial de otra pestaña) **tumba todas las páginas del sitio**, sin `ErrorBoundary`. | `frontend-astro/src/stores/carrito.js:9-12` |
| D-3 | Doble clic en "Confirmar pedido" → **dos pedidos reales**. `setProcesando(true)` es asíncrono, el botón no se deshabilita a tiempo, el backend no tiene idempotencia y no valida stock. | `frontend-astro/src/components/CarritoCheckout.jsx:20-36, 98-104` |

### 1.3 Veredicto en una frase

- **Rama antigua:** código legible, honesta y bien documentada para un ejercicio académico,
  con **cero modelo de seguridad**. Su backend es la mitad de una app sin autenticación,
  y su frontend tiene dos bugs que rompen el flujo principal de compra.
- **Rama nueva:** la capa de autenticación es un salto grande y **correcto**
  (el `id_token` de Google sí se verifica server-side). Pero al añadir **PostgREST como
  segunda puerta de entrada se duplicó la superficie de ataque sin duplicar los controles**:
  los permisos de la API REST son *más amplios* que los del schema GraphQL, y el backend
  GraphQL conecta a Postgres como **superusuario**, lo que anula la RLS que sí se escribió.

---

## 2. Mapa del repositorio y de las ramas

### 2.1 Grafo de commits

```
*   920d435 (HEAD -> Astro+Mongo, origin/Astro+Mongo) Conflictos resueltos en el README
|\
| * 1d4c3d7 (origin/HEAD -> origin/main, main) Create README.md with project overview
| * e42dd47 .env
| * bcf3695 publicacion del proyecto
* 51a93fb AstroYMongoSinOAuth
* a71ff96 Guardar README local temporalmente
```

`main` es **ancestro directo** de `Astro+Mongo` (merge-base = `1d4c3d7`). No hay
divergencia: la rama nueva es una continuación lineal, no un experimento paralelo.

### 2.2 Contenido por rama

| Ruta | Rama | Estado |
|---|---|---|
| `p26-back/` | ambas | Práctica P2-6 · Apollo 5 + better-sqlite3 · **legado** |
| `p26-front/` | ambas | Práctica P2-6 · React 19 + Vite · **legado** |
| `backend/` | solo `Astro+Mongo` | Proyecto final · Apollo 5 + PostgreSQL + PostgREST + JWT |
| `frontend-astro/` | solo `Astro+Mongo` | Proyecto final · Astro 5 SSR + islands React 18 |
| `reportes/` | ambas | `contexto.md`, `reporte-p2.md`, `reporte-p6.md` |
| `README.md` | ambas | ⚠️ plantilla sin rellenar en las dos |

> **Nota de nomenclatura:** la rama se llama `Astro+Mongo` pero **no hay MongoDB en el
> proyecto**. El backend usa PostgreSQL 16 + PostgREST. El nombre de la rama y el
> nombre del commit `51a93fb "AstroYMongoSinOAuth"` inducen a error sobre la
> arquitectura real.

### 2.3 Estado de higiene del repositorio

| Elemento | Estado | Nota |
|---|---|---|
| `.gitignore` raíz | 🔴 **0 bytes** | vaciado por el commit `e42dd47` |
| `backend/.gitignore` | 🔴 no existe | y `backend/src/auth/` maneja JWT y OAuth |
| `frontend-astro/.gitignore` | 🔴 no existe | y maneja `PUBLIC_GOOGLE_CLIENT_ID` |
| `p26-back/.gitignore` | 🟢 existe | correcto |
| `p26-front/.gitignore` | 🟡 parcial | cubre `*.local` pero **no** `.env` |
| `LICENSE` | 🔴 ausente | el README declara MIT |
| Tests | 🔴 cero en las 4 unidades | ningún `test` script, ningún archivo de test |
| CI (`.github/`) | 🔴 no existe | |
| `node_modules` en git | 🟢 ninguno | |
| `package-lock.json` | 🟢 commiteados | buena práctica |

### 2.4 Verificación de secretos en el historial

**Resultado: limpio.** No se commiteó ningún `.env` real en ninguna rama.

```
$ git rev-list --all --objects | grep -i '\.env'
backend/.env.example
frontend-astro/.env.example
p26-back/.env.example
p26-front/.env.example
```

Solo 4 archivos `.env.example`, todos con contenido no sensible (puerto, ruta de BD,
URL de GraphQL, placeholders de secretos).

El commit `e42dd47`, titulado literalmente `.env`, es engañoso por su nombre pero
inocuo en su contenido: solo añadió los dos `.env.example` y vació el `.gitignore` raíz
que los excluía (necesario para poder commitearlos).

- 🟡 **Email personal público**: `PETHSA-01 <betsyely1012@gmail.com>` en todos los commits, en un repositorio público. Recomendable un email `noreply`.
- 🟡 **Historia sin granularidad**: `p26-back` y `p26-front` entraron completos en **un solo commit** (`bcf3695`, 45 archivos, 7 715 líneas). Imposible hacer bisect ni atribuir qué cambió con qué tarea.

---

## 3. Hallazgos transversales

Los siguientes hallazgos aparecen **en las dos ramas**. Son los más relevantes porque
arrastrados de `main` a `Astro+Mongo` sin corregirse.

### 🔴 T-1 — `.gitignore` raíz vacío: los secretos son commiteables

**Presente en:** ambas ramas · **Severidad: CRÍTICO (latente)**

El `.gitignore` raíz tiene **0 bytes**. El commit `e42dd47` lo vació (tenía 2 líneas
que excluían precisamente los `.env.example` que ese commit añadía).

```
$ wc -c .gitignore
0 .gitignore

$ git check-ignore backend/.env frontend-astro/.env
(sin salida → NO ignorados)
```

| Ruta | Estado |
|---|---|
| `p26-back/.env` | 🟢 ignorado (`p26-back/.gitignore:10`) |
| `p26-back/nexoplay.db` | 🟢 ignorado |
| `backend/.env` | 🔴 **NO ignorado** |
| `frontend-astro/.env` | 🔴 **NO ignorado** |
| `.env` (raíz) | 🔴 **NO ignorado** |
| `p26-front/.env` | 🔴 **NO ignorado** |

**Por qué es crítico en la rama nueva:** `backend/src/auth/jwt.js` y
`backend/src/auth/google.js` hacen que `backend/.env` contenga `JWT_SECRET` y
`GOOGLE_CLIENT_SECRET`. `backend/.env.example:8` instruye a pegarlos ahí. El próximo
`git add -A` los sube a un repositorio público.

**Remediación** (una vez, en la raíz):
```gitignore
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
*.log
.DS_Store
```

---

### 🔴 T-2 — `crearPedido` nunca valida ni descuenta stock (idéntico en ambos backends)

**Presente en:** `p26-back` + `backend/` · **Severidad: CRÍTICO** · **Deuda heredada**

Es el **mismo bug de lógica en las dos implementaciones**, escrito con dos ORM distintos.

`p26-back/src/resolvers.js:98-105`:
```js
const renglones = datos.detalles.map((r) => {
  const producto = stmts.productoById.get(r.productoId);
  if (!producto) { throw new Error(...); }
  total += producto.precio * r.cantidad;   // ← nunca lee producto.stock
  return { productoId: producto.id, cantidad: r.cantidad, precioUnitario: producto.precio };
});
```

`backend/src/resolvers.js:102-115`:
```js
const producto = await client.queryOne('SELECT * FROM productos WHERE id = $1', [r.productoId]);
if (!producto) { throw new Error(...); }
total += Number(producto.precio) * r.cantidad;   // ← nunca lee producto.stock
renglones.push({ productoId: producto.id, cantidad: r.cantidad, precioUnitario: producto.precio });
```

Cuatro consecuencias:

1. **No hay validación de stock.** Con 1 unidad disponible se pueden pedir 1 000 000.
2. **No hay decremento.** No existe ningún `UPDATE productos SET stock = stock - ?` en
   ninguno de los dos backends. El inventario nunca baja.
3. **`cantidad` negativa → `total` negativo.** Ni el schema (`cantidad: Int!` sin mínimo),
   ni la base de datos (`INTEGER NOT NULL` sin `CHECK`), ni los resolvers validan el signo.
4. **El frontend tampoco protege**, y en la rama nueva es *peor*: el store no guarda
   `stock` en el renglón.

```
crearPedido(detalles: [{productoId: "3", cantidad: -50}])
→ INSERT INTO pedidos (…, total: -34995.00, …)   ← aceptado
```

**Agravante en la rama nueva:** el backend viejo era **síncrono y monohilo**
(`better-sqlite3` + `db.transaction`), lo que serializaba todas las escrituras gratis.
El nuevo usa un **pool asíncrono de 10 conexiones** (`backend/src/db.js:10-12`), por lo
que esa serialización se perdió. Dos pedidos concurrentes por el mismo producto se
procesan en paralelo.

---

### 🟠 T-3 — `eliminarProducto` revienta por foreign key (idéntico en ambos backends)

**Presente en:** `p26-back` + `backend/` · **Severidad: ALTO** · **Deuda heredada**

`p26-back/db.sql:55` y `backend/db/init.sql:74` declaran la FK **sin `ON DELETE`**:
```sql
producto_id INTEGER NOT NULL REFERENCES productos(id)   -- sin ON DELETE
```

Obsérvese el contraste con la línea siguiente de `p26-back/db.sql:54`, que **sí** lleva
`ON DELETE CASCADE`. La omisión es inconsistente dentro del mismo archivo.

**Verificado empíicamente** con `better-sqlite3@11.10.0` replicando el schema exacto:
```
eliminarProducto LANZA: SqliteError | code: SQLITE_CONSTRAINT_FOREIGNKEY
                              | message: FOREIGN KEY constraint failed
```

Impacto: la mutación es **inviable para cualquier producto ya vendido** — y el seed
sembrado (`p26-back/db.sql:88-90`) crea exactamente ese caso.

En la rama nueva es **peor**, porque el error de Postgres se filtra al cliente con su
nombre de constraint (ver T-5).

---

### 🟠 T-4 — `startStandaloneServer`: CORS `*`, body de 50 MB, sin depth limit, sin rate limit

**Presente en:** `p26-back` + `backend/` · **Severidad: ALTO**

Los dos backends arrancan con el mismo helper y sin opciones:

```js
// p26-back/index.js:15  y  backend/index.js:20
const { url } = await startStandaloneServer(server, { listen: { port } });
```

Verificado en `@apollo/server@5.5.1/dist/cjs/standalone/index.js`:

| Línea del helper | Comportamiento por defecto | Consecuencia |
|---|---|---|
| 19 | `cors()` **sin argumentos** | `Access-Control-Allow-Origin: *` |
| 30-32 | `bodyParser.json({ limit: '50mb' })` | 50 MB por request sin autenticar |
| 30-32 | sin `validationRules` | **ningún límite de profundidad** |
| — | sin plugins | sin rate limit, sin CSRF prevention |
| — | sin `process.on('SIGTERM'/'SIGINT')` | sin graceful shutdown |

Apollo Server 5 **no aplica ningún depth limit por defecto** (verificado en
`requestPipeline.js:108`: `internals.validationRules` está vacío porque
`index.js:8-11` no declara ninguno).

**Ataque:** con el ciclo `Categoria.productos ↔ Producto.categoria` y `Query.pedidos`
sin paginar, una consulta anidada 12 niveles produce ~3¹² ≈ **531 000 queries**.

CORS abierto combinado con A-1 (IDOR en la rama antigua) permite ejecutar las mutations
de escritura **desde el navegador de cualquier desarrollador que tenga el backend corriendo**.

---

### 🟠 T-5 — `NODE_ENV` nunca se define: introspection y stack traces activos

**Presente en:** `p26-back` + `backend/` · **Severidad: ALTO**

Verificado en `@apollo/server@5.5.1/dist/cjs/ApolloServer.js`:
```js
const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? '';   // '' — nadie lo pone
const isDev = nodeEnv !== 'production';
const introspectionEnabled = config.introspection ?? isDev;    // → INTROSPECCIÓN ACTIVADA
includeStacktraceInErrorResponses: config.includeStacktraceInErrorResponses ??
    (nodeEnv !== 'production' && nodeEnv !== 'test'),          // → TRUE
```

`NODE_ENV` **no aparece** en `.env.example`, ni en `docker-compose.yml`, ni en los
scripts de `package.json`, en ninguna de las dos ramas. Consecuencia: en **cualquier**
entorno, el servidor arranca en modo dev → **introspection completa + stack traces en las
respuestas de error** + landing page de desarrollo.

En la rama nueva esto se combina con T-3: el mensaje crudo de Postgres
(`violates foreign key constraint "detalle_pedido_producto_id_fkey"`) llega al usuario
final, revelando nombres de tablas y columnas.

---

### 🟠 T-6 — `Pedido.fecha` roto solo en el backend nuevo

**Presente en:** `backend/` · **Severidad: ALTO** · **Regresión**

| | Rama antigua | Rama nueva |
|---|---|---|
| Tipo en BD | `TEXT` con `DEFAULT (datetime('now'))` | `TIMESTAMPTZ` con `DEFAULT now()` |
| Valor en la app | `"2026-09-29 16:37:00"` (string) | `Date` de JavaScript (OID 1184) |
| Schema GraphQL | `fecha: String!` | `fecha: String!` ← **sin cambio** |
| Lo que recibe el cliente | string correcto | **`"1759164000000"`** (epoch ms) |

El driver `pg` parsea `timestamptz` a un objeto `Date`
(`pg-types/lib/textParsers.js`: `register(1184, parseDate)`).
`GraphQLString.serialize` hace `serializeObject(value)`, que en un `Date` ejecuta
`valueOf()` → un número, y devuelve `(epochMs).toString()`.

`backend/src/resolvers.js:172` — `fecha: (pedido) => pedido.fecha` no mitiga nada.

**Currently latente**, no visible: el frontend nuevo todavía no consulta `fecha`
(no aparece en `frontend-astro/src/lib/graphql.js`). Pero cualquier consulta que lo
pida devuelve basura.

---

### 🟡 T-7 — Dinero en punto flotante en los dos backends

**Presente en:** ambas ramas · **Severidad: MEDIO**

| | Rama antigua | Rama nueva |
|---|---|---|
| Columna | `precio REAL`, `total REAL` | `precio NUMERIC(10,2)`, `total NUMERIC(10,2)` |
| Acumulación | `float64` en JS | `float64` en JS (`resolvers.js:109`) |
| Tipo GraphQL | `Float!` | `Float!` |

La rama nueva **mejoró el tipo de columna** (`REAL` → `NUMERIC`), pero `pg-types` no
registra el OID 1700, así que `NUMERIC` llega a JS como **string** y se coacciona con
`Number(...)` en el resolver. El redondeo ocurre recién al insertar. `Pedido.total` puede
no coincidir con `sum(detalle.subtotal)` y no hay invariante en base de datos que lo fuerce.

`0.1 + 0.2 != 0.3` aplica a ambos.

---

### 🟡 T-8 — Cero índices en los dos schema de base de datos

**Presente en:** `p26-back/db.sql` + `backend/db/init.sql` · **Severidad: MEDIO**

**Verificado: cero `CREATE INDEX` en ambos archivos.**

Faltan índices en exactamente las columnas por las que filtran los field resolvers y
las políticas RLS:

| Índice faltante | Consulta que lo sufre |
|---|---|
| `productos(categoria_id)` | `resolvers.js:153` (nuevo) / `:10` (viejo) |
| `pedidos(usuario_id)` | `resolvers.js:45, 165` + subqueries de RLS (`init.sql:198-208`) |
| `detalle_pedido(pedido_id)` | `resolvers.js:171` + RLS (`init.sql:198-201`) |
| `detalle_pedido(producto_id)` | usado por el `DELETE` que falla (T-3) |
| `pedidos(status)`, `pedidos(fecha)` | `ORDER BY id DESC` + historial |

Con los 8 productos del seed no se nota. Con volumen real, el N+1 documentado se
convierte en **N+1 full table scans**.

---

### 🟡 T-9 — Cero tests, cero CI, cero linter en la rama nueva

**Presente en:** ambas ramas (parcial) · **Severidad: MEDIO**

| | `p26-back` | `p26-front` | `backend/` | `frontend-astro/` |
|---|---|---|---|---|
| Script `test` | ❌ | ❌ | ❌ | ❌ |
| Tests | ❌ | ❌ | ❌ | ❌ |
| Linter | ❌ | 🟢 `oxlint` | ❌ | ❌ **regresión** |
| `engines` | ❌ | ❌ | ❌ | ❌ |
| `private: true` | ❌ | 🟢 | ❌ | ❌ **regresión** |
| CI | ❌ | ❌ | ❌ | ❌ |

La rama nueva **perdió el linter** que sí tenía la antigua. Y con la autenticación
OAuth añadida, la lógica de negocio pasó de "un `usuarioId` fijo" a "un flujo de sesión
completo" — que es exactamente el tipo de código que necesita tests.

**Caso especial de alto valor:** `maquina(estado, evento)` en `p26-front/src/App.jsx:23-50`
es una **función pura y perfectamente testeable**. 10 casos de tabla y 30 líneas de test
habrían atrapado B-1 y el bug de `volverAProducto` ambiguo al instante.

---

### 🟡 T-10 — El README raíz es la plantilla sin rellenar en ambas ramas

**Presente en:** ambas ramas · **Severidad: MEDIO**

`README.md` en `main` y en `Astro+Mongo` es prácticamente el mismo texto de plantilla:

- Dice `├── backend/` y `├── cliente/` — **`cliente/` no existe en ninguna rama**
- Instruye `cd cliente && npm install` — **falla**
- `.env` de ejemplo con `DB_HOST` / `DB_USER` / `DB_PASSWORD` — no aplica a SQLite ni a la URL de Postgres actual
- Puerto 3000 — el backend real usa 4001
- La sección "Características" dice *"CRUD de ..."* y *"(Agrega las funciones reales)"*
- La sección "Tecnologías" dice *"MySQL / MongoDB ..."* — **no hay MySQL ni MongoDB**

En la rama nueva es peor: el README **no menciona `backend/` ni `frontend-astro`** en
absoluto, así que un evaluador no puede saber cuál es el proyecto vigente.

---

### 🟡 T-11 — Requisitos de Node documentados incorrectamente

**Presente en:** ambas ramas · **Severidad: MEDIO**

| Componente | README dice | Realidad |
|---|---|---|
| `p26-back` | "Node.js 18 o superior" | `@apollo/server@5.5.1` requiere `>=20` |
| `p26-front` | "Node.js 18 o superior" | Vite 8 requiere `>=20.19` / `22.12+` |
| `backend` | (README raíz) "Node >= 18" | `@apollo/server@5.5.1` requiere `>=20` |
| `frontend-astro` | — | Astro 5 requiere `>=18.17.1` / `>=20.3` |

Ningún `package.json` tiene campo `engines`, así que npm no avisa. Con Node 18 el
arranque falla con un error poco claro.

---

### 🟡 T-12 — Passwords de seed que **simulan** estar hasheados

**Presente en:** ambas ramas · **Severidad: MEDIO**

`p26-back/db.sql:81-82` y `backend/db/init.sql:101-102`:
```sql
('Admin NexoPlay', 'admin@nexoplay.com', 'hashed:admin123', 'ADMIN')
('Juan Perez', 'juan.perez@example.com', 'hashed:juan123', 'CLIENTE')
```

Dos problemas distintos:

1. **`'hashed:admin123'` NO es un hash.** Es el string `"admin123"` con un prefijo
   decorativo. Quien lo lea asumirá que está hasheado. Es la peor forma posible: falsa
   sensación de seguridad.
2. **La rama nueva no tiene ninguna dependencia de hashing** — no hay `bcrypt` ni
   `argon2` en `backend/package.json`. El comentario de `init.sql:98-100` admite que
   "en producción se cambiaría por un hash real (bcrypt)".

En la rama nueva, además, la columna `password` es **código muerto**: no existe ninguna
mutación de login local en `schema.js`, así que nadie puede usar esa credencial. Pero la
fila es el objetivo natural de C-2 (escalada de rol) y de A-8 (lectura de la columna
`password` por PostgREST).

El dominio `admin@nexoplay.com` no usa el reservado `example.com` que sí usa el segundo
usuario, lo que lo hace potencialmente atacable por credential-stuffing.

---

## 4. Rama antigua — `p26-back` (Apollo Server 5 + better-sqlite3)

**32 hallazgos: 3 CRÍTICO, 7 ALTO, 12 MEDIO, 10 BAJO**
*(2 de los 3 críticos y 2 de los 7 altos están documentados en §3 como transversales)*

### 4.1 Arquitectura

```
index.js
 ├─(1)─► src/schema.js      → typeDefs como template string (línea 1-117)
 ├─(2)─► src/resolvers.js   → importa { db } de ./db.js
 │           └─(2.a)─► src/db.js  → abre la BD, aplica db.sql si es nueva
 └─(3)─► src/db.js
```

**Detalle no obvio y engañoso:** el comentario de `index.js:6` dice que la línea 6
*"se asegura de inicializar la base antes de arrancar"*, pero los imports de ESM se
evalúan **en orden de código fuente**, y `index.js:5` (`resolvers.js`) se evalúa
**antes** que `index.js:6` (`db.js`). La línea 6 es un **no-op**: la BD ya está abierta
porque `src/resolvers.js:1` la importa. Funciona por la garantía de módulos de ESM, no
por lo que sugiere el comentario.

**Flujo de `crearPedido` (el más complejo):**
```
Mutation.crearPedido (resolvers.js:85)
 ├─ 86  usuarioById.get(datos.usuarioId)        ── FUERA de transacción
 ├─ 88  if (!usuario) throw                     ── FUERA
 ├─ 90  if (!detalles?.length) throw            ── FUERA
 ├─ 96  const crear = db.transaction(...)       ── ⚠ creado EN CADA llamada
 │    ├─ 98-105  productoById.get() + total += precio*cantidad
 │    ├─ 107  insertPedido  (status fijo 'PENDING')
 │    └─ 110-112 insertDetalle por renglón
 └─ 118 pedidoById.get(pedidoId)
```

**Lo correcto:** los precios y el total se resuelven **dentro** de la transacción, así que
no hay time-of-check/time-of-use entre leer el precio e insertarlo. Los renglones son
consistentes y el rollback de `better-sqlite3` es automático.

**Lo ausente:** validación de stock, validación de cantidades positivas, decremento de stock.

### 4.2 CRÍTICOS

Ya documentados en §3: **T-1** (`.gitignore`), **A-1** (IDOR), **A-2** (depth limit).

Añadido aquí, propio de esta rama:

#### `p26-back` — el campo `rol` existe y nunca se lee
`db.sql:34` define `rol TEXT CHECK (rol IN ('ADMIN','CLIENTE'))` y `schema.js:41` lo expone
en el tipo `Usuario`. `grep` sobre `src/` no encuentra **ninguna** lectura de `rol`.
El modelo de autorización existe en el schema pero está desconectado de la lógica.

### 4.3 ALTOS

Ya documentados en §3: **T-3** (`eliminarProducto`), **T-4** (`startStandaloneServer`),
**T-11** (Node). Propios de esta rama:

#### `p26-back` — `productos(limite: null)` crashea el servidor
`resolvers.js:48`:
```js
productos: (_, { limite = 20, desde = 0 }) => stmts.productosPage.all(limite, desde),
```
Los defaults JS **solo aplican a `undefined`**, nunca a `null`. El schema declara
`limite: Int` nullable (`schema.js:97`), así que `productos(limite: null)` es legal.
Verificado empíricamente con `better-sqlite3@11.10.0`:
```
sin args       → ERROR: Too few parameter values were provided
(null, null)   → ERROR: SQLITE_MISMATCH | datatype mismatch
(1, 1)         → [{"id":2,...}]  ✓
```
Además `limite: -1` devuelve **toda la tabla** (en SQLite, límite negativo = sin límite)
y `limite: 1000000` también. **No hay validación de rango** → `Query.productos` es un
volcado completo de tabla. El default real (`20`) **no está documentado en ningún sitio**.

#### `p26-back` — `DB_PATH` relativo se resuelve contra `process.cwd()`, no contra `__dirname`
`.env.example:5` → `DB_PATH=./nexoplay.db` · `db.js:7` → `process.env.DB_PATH || path.join(__dirname, '..', 'nexoplay.db')`

Sonda empírica (escritura en `/tmp`, limpiada después):
```
cwd del proceso    : /home/pethsa/Downloads/ProyectoWebIICompleto
DB_PATH (relativo) : ../../../../../../tmp/opencode/relpath-probe.db
db.name devuelto  : ../../../../../../tmp/opencode/relpath-probe.db   ← crudo, NO resuelto
ruta ABSOLUTA real : /tmp/opencode/relpath-probe.db
```
`better-sqlite3` resuelve contra `process.cwd()`. **Escenario de fallo concreto:** si
alguien corre `node p26-back/index.js` desde la raíz (documentado en el README raíz), con
el `.env` de `.env.example`, se crea un `nexoplay.db` **huérfano en la raíz del repo**.
Peor: si ya existe un `nexoplay.db` **vacío o corrupto** en ese cwd, `db.js:10` evalúa
`isNewDatabase = false` → `db.sql` **nunca se aplica** → cada resolver falla con
`no such table: categorias`.

Nota la asimetría dentro del mismo archivo: `db.js:8` (`SCHEMA_PATH`) **sí** usa `__dirname`.

#### `p26-back` — `db.exec(schema)` sin transacción: DB rota e irrecuperable
`db.js:15-18`:
```js
if (isNewDatabase || process.env.RESET_DB === 'true') {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
```
`db.sql:8-12` ejecuta 5 `DROP TABLE`. Si cualquier sentencia posterior falla (disco lleno,
`db.sql` corrupto), **`db.exec` no tiene transacción implícita**: los `DROP` ya están
commiteados y los `CREATE`/`INSERT` parciales quedan aplicados. En el siguiente arranque
el archivo existe → `db.js:10` da `false` → **el schema nunca se vuelve a aplicar** y no
hay recuperación salvo `rm nexoplay.db` a mano. El único mensaje es un `console.log`
(`db.js:18`) emitido **después** de que todo haya funcionado.

#### `p26-back` — Exposición de PII por `Query.pedidos` público y sin paginar
`schema.js:40` expone `email: String!` en `Usuario`. Como `Query.pedidos`
(`resolvers.js:51`) es público y no pagina, cualquiera puede enumerar todos los pedidos
y con ellos **todos los emails de todos los usuarios**:
```graphql
{ pedidos { usuario { email } } }
```
El campo `password` **sí** está correctamente excluido del schema (`schema.js:37-44`).

#### `p26-back` — Sin logging: los errores son invisibles
No hay un solo `console.error` en `src/`, ni `formatError` en `index.js`. Los errores de
SQLite se convierten en `INTERNAL_SERVER_ERROR` opaco **y desaparecen**: ni servidor ni
cliente sabe qué pasó. Contrasta con `p26-front/reporte-p6.md:338`, que afirma *"lo vi en
los logs de SQLite"* — ese logging **no existe en el código**.

### 4.4 MEDIOS

| # | Hallazgo | Evidencia |
|---|---|---|
| `p26-back` M-1 | `Pedido.usuario` / `Producto.categoria` / `DetallePedido.producto` pueden devolver `undefined` contra tipos `!` → la primera fila huérfana **anula toda la consulta** (propagación de null en GraphQL) | `schema.js:33,50,63` vs `resolvers.js:131,139,145` |
| `p26-back` M-2 | `db.transaction()` construido en **cada invocación** del resolver | `resolvers.js:96` |
| `p26-back` M-3 | `Pedido.fecha` es un resolver no-op que devuelve el campo crudo, con formato SQLite sin sufijo `Z` → desfase de zona horaria en el front | `resolvers.js:141`, `db.sql:40` |
| `p26-back` M-4 | El enum `EstadoPedido` declara 5 estados pero solo `'PENDING'` se produce; no existe mutación para transicionar | `schema.js:9-15`, `resolvers.js:28` |
| `p26-back` M-5 | Sin graceful shutdown: no hay `process.on('SIGTERM'/'SIGINT')` ni `db.close()` | `index.js:15-19` |
| `p26-back` M-6 | Sin manejo de errores de arranque: `EADDRINUSE` → *unhandled rejection* con stack crudo; `PORT=abc` → `listen(NaN)` | `index.js:15-16` |
| `p26-back` M-7 | `new Database(DB_PATH)` sin `fs.mkdirSync` del directorio destino → `SQLITE_CANTOPEN` en tiempo de import | `db.js:12` |
| `p26-back` M-8 | No existe `Query.usuario` ni `Query.usuarios`: la tabla `usuarios` solo es alcanzable anidada vía `Pedido.usuario` | `schema.js:90-103` |
| `p26-back` M-9 | Ausencia total de `WAL` y `busy_timeout` → `SQLITE_BUSY` inmediato con escrituras concurrentes | `db.js:12-18` |
| `p26-back` M-10 | `graphql: "^16.9.0"` viola el peer de `@apollo/server@5.5.1`, que exige `^16.11.0` | `package.json:15` |
| `p26-back` M-11 | `dotenv@16.6.1` está ~1 major atrás (actual: 17.x) | `package.json:14` |
| `p26-back` M-12 | El seed tiene `categoria_id` hardcodeados (1,2,3) asumiendo que `AUTOINCREMENT` arranca en 1; cualquier reordenamiento rompe el seed silenciosamente | `db.sql:70-78` |

### 4.5 BAJOS

- **8 de 14 statements usan `SELECT *`** (`resolvers.js:8-35`) — frágil ante columnas nuevas.
- **No hay `UNIQUE (pedido_id, producto_id)`** en `detalle_pedido` → `crearPedido` con el mismo producto 5 veces crea 5 filas en vez de consolidar.
- **Faltan `CHECK`**: `precio >= 0`, `stock >= 0`, `cantidad > 0`, `total >= 0`.
- `db.sql:6` — `PRAGMA foreign_keys = ON` es redundante con `db.js:13` para la app, y **engañoso** para el uso manual del README (las pragmas son *session-scoped*).
- `db.sql:71-78` — URLs de imágenes de terceros hotlinkeadas (`encrypted-tbn0.gstatic.com`, `m.media-amazon.com`): dependencia externa en runtime y vector de tracking, ya que `imagen` es una **URL arbitraria sin validar** que el cliente escribe.
- `db.sql:58-63` — el comentario de cabecera está **duplicado** (basura de merge).
- Sin `devDependencies`, sin `engines`, sin `license`, sin `repository`, sin `"private": true`.
- `allowScripts` es un campo real (npm ≥ 11.5) y la lista es correcta, pero el README dice "npm 12+" cuando se introdujo en 11.5.0.

### 4.6 Lo que está bien (crédito)

- ✅ **Cero inyección SQL.** Las 14 consultas son *prepared statements* con placeholders `?`;
  no hay concatenación de strings en SQL en ningún punto. `SELECT *` es feo pero no inyectable.
- ✅ `db.js:13` — `db.pragma('foreign_keys = ON')`. Verificado empíricamente: sin esta
  línea los `INSERT` con padre inexistente pasan silenciosamente.
- ✅ `db.sql:53` — `precio_unitario` denormalizado en `detalle_pedido` es un **snapshot
  correcto**: cambiar el precio de un producto no altera pedidos históricos.
- ✅ `db.sql:34, 42-43` — `CHECK` en los enums `rol` y `status`.
- ✅ Orden de `DROP TABLE` correcto (`db.sql:8-12`: hijos antes que padres).
- ✅ `package-lock.json` **consistente**: `lockfileVersion 3`, 0 entradas sin `resolved`,
  `npm audit` con 0 vulnerabilidades, y las versiones instaladas coinciden con el lock.
- ✅ **`p26-back/README.md` es de lo mejor del repositorio**: los ejemplos GraphQL de las
  líneas 70-169 son **correctos y ejecutables** (verificados contra `schema.js`), y las
  líneas 185-197 **documentan honestamente** el problema N+1 proponiendo dos soluciones,
  en vez de vender humo. Disciplina de ingeniería real.

---

## 5. Rama antigua — `p26-front` (React 19 + Vite)

**~48 hallazgos: 2 CRÍTICO, 9 ALTO, 17 MEDIO, ~20 BAJO**

### 5.1 Arquitectura

```
main.jsx:6-10  createRoot(#root).render(<StrictMode><App/></StrictMode>)
App()  App.jsx:131-137
└── CarritoProvider      context/CarritoContext.jsx:10
    └── Flujo()          App.jsx:52   (useReducer + useTransition)
        ├── TopBar       components/layout/TopBar.jsx
        ├── <main>       App.jsx:85-124  → condicional por estado.pantalla
        │   ├── Home              templates/Home.jsx
        │   ├── DetalleCategoria  templates/DetalleCategoria.jsx
        │   ├── DetalleProducto   templates/DetalleProducto.jsx
        │   ├── Carrito           templates/Carrito.jsx
        │   └── Checkout          templates/Checkout.jsx
        └── Footer       components/layout/Footer.jsx
```

**No hay router**, por decisión de diseño: `1PracticaP2-6.md:129-130` pide
*"Tu app NO tiene URLs"*. El enrutado es un `useReducer` puro en `App.jsx:17-50`, y esa
es la decisión correcta. Pero es también la raíz de B-1.

**Cadena de providers verificada:** `StrictMode` activo (`main.jsx:7`) →
en dev todos los efectos se ejecutan **dos veces**. **No hay `ErrorBoundary`** en ningún
punto del árbol: cualquier throw en render deja la página en blanco sin salida.

### 5.2 CRÍTICOS

#### B-1 — El botón "Volver a {categoría}" está roto en el 100 % de los productos abiertos desde el Home

**Cadena exacta verificada:**

1. Usuario en Home pulsa "Ver producto" (`ProductoCard.jsx:22`) → `onVerProducto(id)`.
2. `App.jsx:27-28`:
   ```js
   case 'verProducto':
     return { ...estado, pantalla: 'producto', productoId: evento.productoId };
   ```
   **No toca `categoriaId`.** Como se venía de `home` (`estadoInicial`, `App.jsx:17-21`),
   `categoriaId` sigue en `null`.
3. `DetalleProducto.jsx:72` renderiza `← Volver a {producto.categoria.nombre}` →
   `App.jsx:107` → `handlers.onVolverACategoria`.
4. `App.jsx:39-40`:
   ```js
   case 'volverACategoria':
     return { ...estado, pantalla: 'categoria', productoId: null };
   ```
   → pantalla `categoria` con `categoriaId: null`.
5. `App.jsx:97` pasa `categoriaId={null}` → `DetalleCategoria.jsx:19`:
   ```js
   graphqlRequest(QUERIES.categoria, { id: categoriaId })   // { id: null }
   ```
6. `client.js:37-38` declara `query Categoria($id: ID!)` → GraphQL devuelve
   `Variable "$id" got invalid value null` → `client.js:20-22` lanza →
   `ErrorMessage.jsx:7` muestra el error con un botón "Reintentar" que **vuelve a fallar igual**.

**Impacto:** el usuario queda atrapado en un loop de error irrecuperable salvo por el
logo del TopBar. Y el 100 % de los productos alcanzados desde el grid del Home — la ruta
de descubrimiento principal — tienen el botón roto.

**Ironía:** el dato necesario **ya está disponible y se pide en la query**
(`client.js:60` trae `categoria { id nombre }`), pero `DetalleProducto` nunca lo
devuelve al flujo.

#### B-2 — Carrera entre `vaciarCarrito()` y `onPedidoCreado()`

`Checkout.jsx:85-92`:
```js
graphqlRequest(MUTATION_CREAR_PEDIDO, { datos })
  .then(() => {
    vaciarCarrito();          // ← setState en el Context (commit A)
    onPedidoCreado();          // ← dispatch → pantalla 'home' (commit B)
  })
```

`vaciarCarrito()` (estado del `CarritoProvider`, **un nivel por encima** de `Flujo`) y
`onPedidoCreado()` (dispatch en `Flujo`) viven en **raíces de React distintas**. React 19
no garantiza el orden de commit entre un `setState` de un provider ancestro y un dispatch
de un descendiente: React puede descartar el render de `Flujo` y reintentarlo.

**Escenario de fallo:** React aplica el commit B primero, `Flujo` vuelve a Home y `Home`
se monta con `useEffect` (`Home.jsx:62-65`) que dispara `cargarCategorias()` +
`cargarProductos(true)`. Si el commit A se aplaza, el carrito **no se vacía**: el `TopBar`
sigue mostrando el contador y `ContextBar` muestra *"Llevas N productos — $X"*.
El usuario ve su carrito aparentemente "pagado" pero intacto, en la home.

**Agravante:** si el carrito no se vacía, pulsar "Finalizar compra" de nuevo crea un
**segundo pedido idéntico** — el backend no tiene idempotencia ni deduplica
(`p26-back/src/resolvers.js:85-119`).

### 5.3 ALTOS

| # | Hallazgo | Evidencia |
|---|---|---|
| F-1 | **`agregarAlCarrito` no valida stock y el backend tampoco.** El Context **suma sin clampear** (`CarritoContext.jsx:19`) mientras que el clamp solo vive en `actualizarCantidad` (`:41-42`), que la UI de agregar no llama. Con `stock: 3` se pueden tener 5 unidades. La integridad de inventario depende 100 % de un cliente no confiable. | `context/CarritoContext.jsx:13-25, 41-42` |
| F-2 | **El buscador da falsos negativos.** Filtra solo sobre los productos **ya cargados en memoria** (8 por página) y **oculta la paginación durante la búsqueda** (`Home.jsx:111`). Con 9+ productos, buscar uno de la página 2 muestra *"No encontramos productos con ese nombre"* — una **mentira** verificable contra el backend. Además el input del `TopBar` es visible en Carrito/Checkout/Detalle donde **no hace nada**, y `busqueda` no se resetea al cambiar de pantalla. | `templates/Home.jsx:67-69, 99, 111`; `layout/TopBar.jsx:19-27`; `App.jsx:54` |
| F-3 | **`useTransition` es puramente cosmético, y el reporte afirma lo contrario.** Se descarta `isPending` (nadie lo lee → React renderiza igual de rápido); el fetching ocurre **fuera** de la transición; y `reporte-p2.md:63` dice *"useTransition evita bloqueos al cambiar de pantalla mientras se fetcheen datos"* — **no fetchea nada dentro**. En un ejercicio que se califica sobre "temas del recurso", esto es un error conceptual. | `App.jsx:55, 58`; `reporte-p2.md:63` |
| F-4 | **`useEffect` sin cleanup → doble fetch y condiciones de carrera.** Con `StrictMode`, `Home.jsx:62-65` dispara **4 peticiones GraphQL idénticas** en cada mount. `Home.jsx:48-54` **sí tiene** guard de secuencia (`requestId`), pero el mismo patrón falta en `DetalleCategoria.jsx:25-28` y `DetalleProducto.jsx:31-34`, que solo silencia con `eslint-disable-next-line`. | `templates/*.jsx`; `main.jsx:7` |
| F-5 | **"← Seguir comprando" hace dos cosas distintas.** El mismo label lleva al detalle del último producto o a Home, según cómo se llegó al carrito. No determinista desde el punto de vista del usuario. | `App.jsx:41-44, 113`; `templates/Carrito.jsx:82, 92` |
| F-6 | **`.env` NO ignorado en el front.** `p26-front/.gitignore` cubre `*.local` (`:13`) pero **no** `.env` ni `.env.*`; el `.gitignore` raíz está vacío. | `.gitignore` raíz; `p26-front/.gitignore` |
| F-7 | **`reporte-p6.md:20` documenta `http://localhost:4001/graphql`, que es incorrecto.** `startStandaloneServer` sin `path` sirve GraphQL en `/`; `/graphql` devuelve el **HTML de Apollo Sandbox**. Quien copie el endpoint del reporte obtiene `SyntaxError: Unexpected token '<'` al hacer `response.json()`. El error más grave de todo el reporte. | `reporte-p6.md:20` vs `p26-back/index.js:15` |
| F-8 | **`actualizarCantidad` puede dejar `cantidad = 0`.** `Math.min(Math.max(cantidad, 1), maximo)` con `stock === 0` → `0 ?? cantidad` evalúa a `0` (el `??` solo sustituye `null`/`undefined`) → `Math.min(1, 0) === 0`. Renglón con subtotal `$0.00` y **ambos botones deshabilitados** (`Carrito.jsx:29, 38`). | `context/CarritoContext.jsx:41-42`; `templates/Carrito.jsx:29, 38` |
| F-9 | **`.carrito-item` desborda en móvil.** `index.css:508-518` usa `grid-template-columns: 1fr auto auto auto` **sin ningún media query**; mínimo realista ~470 px en un viewport de 360 px útiles. Es la pantalla más usada después del Home. `.footer__contenido` (`:613-618`) tampoco tiene `flex-wrap`. | `index.css:508-518, 613-618` |

### 5.4 MEDIOS

| # | Hallazgo | Evidencia |
|---|---|---|
| F-10 | **El formulario de Checkout nunca envía sus datos.** `form.nombre`, `form.direccion` y `form.metodoPago` — con validaciones, `aria-invalid`, `aria-describedby` — **se descartan**. Solo viajan `usuarioId` y `detalles`. Es *spec-compliant*, pero la app pide dirección de envío y la tira. | `templates/Checkout.jsx:77-83` vs `:120-167` |
| F-11 | **`value` del Context sin memoizar** → cada tecla del buscador re-renderiza Provider → TopBar → ContextBar → Home → las 8 `ProductoCard`. | `context/CarritoContext.jsx:60-70`; `App.jsx:54, 60-74` |
| F-12 | **"Cargar más" falla → se pierde todo el catálogo ya cargado.** `ErrorMessage` **reemplaza el grid entero** y el botón desaparece (vive en la rama `else`). | `templates/Home.jsx:94-95, 111-121` |
| F-13 | **Sin `ErrorBoundary`.** Puntos de throw plausibles: `producto.precio.toFixed(2)`, `categoria.productos.length`, `it.producto.precio` por `NaN`, `totalPrecio.toFixed(2)`. Ninguno protegido. | `main.jsx:6-10`; `ProductoCard.jsx:19`; `Sidebar.jsx:24` |
| F-14 | **`graphqlRequest` filtra errores internos al usuario** y no valida `content-type`. Mensajes de GraphQL pueden filtrar nombres de tablas y columnas. | `graphql/client.js:14-24` |
| F-15 | **El front es el detonante del N+1 documentado.** `client.js:28-36` pide `categorias { productos { id } }` y `Sidebar.jsx:24` usa `categoria.productos.length`: pide un array de objetos entero **solo para obtener `.length`**. | `graphql/client.js:28-36`; `layout/Sidebar.jsx:24` |
| F-16 | **Contraste WCAG AA fallido** en 6+ sitios; el más grave es `.boton--primario:disabled` en **1.85:1** (blanco sobre `#c4b5fd`), precisamente el estado "Sin stock" y "Confirmar compra" deshabilitado. Ver anexo B. | `styles/tokens.css:69-72`; `index.css:435-460, 619-621` |
| F-17 | **Jerarquía de encabezados rota en Home:** `Sidebar.jsx:8` monta `<h2>Categorias</h2>` **antes** del `<h1>` de `Hero.jsx:6`. | `templates/Home.jsx:77, 86` |
| F-18 | **`aria-label` en `<div>` sin `role` no se anuncia** (ARIA). Debería ser `role="status" aria-live="polite"`. | `components/Skeleton.jsx:7, 21` |
| F-19 | **En móvil el sidebar se apila *encima* del Hero**: `index.css:111-115` solo cambia a una columna, y el sidebar es el primer hijo. Con 15 categorías el usuario no ve un solo producto. | `index.css:111-115`; `templates/Home.jsx:73` |
| F-20 | **Validación de checkout triplicada:** la misma regla en 3 sitios (`Checkout.jsx:43-47`, `:62-66`, `:49-51`). Y `:69-72` es **código inalcanzable** porque el botón tiene `disabled={!esValido}`. | `templates/Checkout.jsx:43-72` |
| F-21 | **`SkeletonDetalle` en Checkout tiene `aria-label="Cargando producto"`** cuando debería decir "Procesando pedido". | `templates/Checkout.jsx:101`; `Skeleton.jsx:21` |
| F-22 | **`búsqueda` sin protección:** `p.nombre.toLowerCase()` tumba todo el render de Home si falta el nombre. Falta `?? ''` (coherente con el resto del código, que sí usa `??`). | `templates/Home.jsx:68` |
| F-23 | **`README.md` miente de forma sistémica:** dice que Checkout es *"sin formulario de envio/pago todavia"* (existe completo en `:120-167`); que el carrito *"permite quitar"* omitiendo que edita cantidades y confirma; que los eventos son *"exactamente como en el diagrama de la práctica"* (faltan 5); *"12 de 15 temas"* (la propia tabla lista 13, y `reporte-p2.md:242` dice 11 — **tres números distintos**); y *"npm run lint → 0 errores"* cuando hay **3 warnings**, uno de ellos `exhaustive-deps` real. | `README.md:44, 46-49, 70, 90, 117` |
| F-24 | **`reporte-p2.md`** tiene 4 errores factuales: `:190` afirma que `DetalleProducto` importa `useCarrito` (**no lo importa**); `:79` describe la firma `graphqlRequest(endpoint, query, variables)` (la real es `(query, variables)`); `:73` dice que `tokens.css` define espaciado y sombras (**no define ninguno**); `:74` dice "CSS modular por componente" (**es un `index.css` monolítico de 621 líneas**). | `reporte-p2.md:73-74, 79, 190` |
| F-25 | **Comentarios JSDoc obsoletos:** `Carrito.jsx:5-13` dice que están *"pendientes"* la edición de cantidades y la confirmación antes de quitar — **las tres están implementadas**. `ProductoCard.jsx:3-4` llama "evento custom" a un callback prop. | `templates/Carrito.jsx:5-13`; `ProductoCard.jsx:3-4` |
| F-26 | **`key` en elemento raíz:** `Carrito.jsx:20` pone `key={item.producto.id}` en el `<li>` raíz de un componente — React lo descarta de `props` y el componente ya está keyeado en `:100`. | `templates/Carrito.jsx:20, 100` |

### 5.5 BAJOS (selección)

- **Código muerto:** `QUERIES.productosDestacados` (`client.js:64-75`, 12 líneas, **nunca importada**), `Checkout.jsx:69-72` inalcanzable, `.boton--peligro` y `a { color: inherit }` sin uso, `src/assets/` vacío.
- **6 `className` sin regla CSS:** `carrito-item__nombre`, `hero__texto`, `home-layout__sidebar`, `home-layout__main`, `sidebar`.
- **6 estilos inline en `Skeleton.jsx`** para simular anchos de línea, exactamente el caso para el que existe un token.
- **`@types/react` y `@types/react-dom` en un proyecto JS puro** sin `tsconfig.json` (`package.json:17-18`).
- **`vite.config.js` esencialmente vacío** (7 líneas, boilerplate de `create-vite`): sin `server.proxy`, sin `build.base`, sin `server.strictPort`.
- `index.html:9` carga Google Fonts sin `crossorigin` (mientras `:8` sí lo hace) → **doble download de fuentes**.
- Comentarios `/* Tarea 2.2 */` y `/* Tarea 2.3 */` en el CSS de producción (`index.css:520-521, 533`) — notas de gestión de proyecto en el stylesheet.
- `max-width: 1180px` duplicado en `tokens.css:48` y `index.css:106`.
- `key={i}` en `Skeleton.jsx:9,12` y `Sidebar.jsx:12`: aceptable (listas estáticas que nunca reordenan), pero contradice `README.md:83`.
- `*.sw?` (swap files de Vim) al final de `p26-front/.gitignore:24` — copiado del template de Vite.

### 5.6 Lo que está bien (crédito)

- ✅ **Cero XSS.** Verificado por grep: sin `dangerouslySetInnerHTML`, `innerHTML`, `localStorage`, `sessionStorage`, `eval`, `new Function`, `document.write`. Los textos se interpolan como JSX → auto-escapeados.
- ✅ **Labelling correcto:** `TopBar.jsx:19-27` — `<label>` envolviendo el input con `<span class="visually-hidden">`.
- ✅ **`Checkout.jsx` es el archivo más accesible del proyecto:** `<label htmlFor>` ↔ `id` correctos (`:121,136,151`), `aria-describedby` apuntando al mensaje (`:130,144,159`), `role="alert"` (`:169`).
- ✅ **`.visually-hidden` correctamente implementado** (`tokens.css:94-101`): `position:absolute` + `clip` + `white-space:nowrap`.
- ✅ **Focus ring del navegador intacto** — verificado: ningún `outline: none` en todo el CSS.
- ✅ **`oxlint` está configurado y funciona** (`.oxlintrc.json` con `$schema` válido, 2 reglas activas). Resultado real ejecutado: **0 errores, 3 warnings**.
- ✅ `package-lock.json` commiteado, `node_modules` y `dist` correctamente ignorados.
- ✅ **`ImagenProducto.jsx` con fallback y `aria-hidden`** es una buena pieza que el frontend nuevo perdió (ver D-3/MEDIO-3).

---

## 6. Rama nueva — `backend/` (Apollo 5 + PostgreSQL + PostgREST + JWT)

**40 hallazgos: 4 CRÍTICO, 8 ALTO, 19 MEDIO, 9 BAJO**
*(4 de los 4 críticos y 4 de los 8 altos están documentados en §3 como transversales)*

### 6.1 Arquitectura

```
Navegador / SSR (Astro)
   │  fetch POST {query, variables} + Authorization: Bearer <JWT>
   ▼
Apollo Server 5 (index.js)  ── context: crearContext()  ──► verifica JWT
   │  typeDefs (SDL, src/schema.js) + resolvers (src/resolvers.js)
   │  makeExecutableSchema()  @graphql-tools/schema
   ▼
pg Pool (src/db.js)  ── SQL parametrizado $1..$n  ──►  PostgreSQL 16 (docker-compose)
   ▲                                                     │
   └──────────── PostgREST (:3000) ── RLS + SET ROLE ───┘
```

**PostgREST** es una API REST autogenerada sobre las mismas tablas, sin capa de aplicación.
No tiene sistema de permisos propio: conecta una sola vez como `authenticator` (sin
privilegios) y por cada request lee el `Authorization: Bearer`, verifica la firma con
`jwt-secret`, lee el claim `role` y ejecuta `SET ROLE <valor>`. Postgres aplica los
`GRANT` y las políticas RLS de ese rol.

**Flujo de autenticación end-to-end (verificado en los 8 saltos):**
```
[1] LoginGoogle.jsx:31-47   window.google.accounts.id → credential (id_token de Google)
[2] graphql.js:75-82        mutation iniciarSesionGoogle(idToken)
[3] resolvers.js:139-141    → verificarIdTokenGoogle() → buscarOCrearUsuarioGoogle() → firmarToken()
[4] google.js:17-20         OAuth2Client.verifyIdToken({ idToken, audience: CLIENT_ID })
                            ↳ valida FIRMA (JWKS de Google), aud, exp, iss
[5] google.js:42-66         busca por google_id → por email (vincula) → INSERT (CLIENTE)
[6] jwt.js:22-34            firma JWT propio { sub, role: web_user|web_admin, rol: ADMIN|CLIENTE } exp 7d
[7] sesion.js:13            guarda { token, usuario } en localStorage
[8] context.js:8-24         por request: extraerTokenDeHeader → verificarToken → context.usuario
[9] resolvers.js:39-48      Query.pedidos filtra por context.usuario.id / rol
[10] PostgREST: mismo JWT → SET ROLE web_user|web_admin → RLS
```

### 6.2 CRÍTICOS

Ya documentados en §3: **C-1** (secreto público), **C-2** (escalada de rol),
**C-3** (`total`/`status` controlados por el cliente), **T-2** (sin stock),
**T-1** (`.gitignore`).

Añadido aquí, propio de esta rama:

#### `backend/` — el backend GraphQL conecta como **SUPERUSUARIO** de Postgres

`docker-compose.yml:8-9`:
```yaml
POSTGRES_USER: nexoplay_app
POSTGRES_PASSWORD: nexoplay_dev
```
`POSTGRES_USER` de la imagen oficial **crea ese rol con SUPERUSER, CREATEDB y CREATEROLE**.
Y `.env.example:3` lo usa como la conexión del backend GraphQL:
```
DATABASE_URL=postgres://nexoplay_app:nexoplay_dev@localhost:5432/nexoplay
```

Consecuencias:

1. **Las políticas RLS de `init.sql:183-218` no aplican a ninguna consulta del camino
   GraphQL.** Un superusuario las bypasea siempre. La autorización depende **solo** de los
   `if` de `context.js:27-41`, sin segunda capa. La RLS da **falsa sensación de defensa
   en profundidad**.
2. Cualquier inyección SQL futura = control total de la instancia, incluyendo
   `pg_read_file`, creación de bases y de roles.

El comentario de `.env.example:2` dice *"Usuario/rol de aplicación (NO el usuario
authenticator)"* — pero el rol elegido es **el más privilegiado de todos**.

`db.js:10-12` además no configura `ssl`, `statement_timeout`, `lock_timeout`, `max` ni
`connectionTimeoutMillis`.

#### `backend/` — `password` y `google_id` expuestos vía `?select=` en PostgREST

`postgrest.conf` **no define `db-pre-request`**, así que PostgREST aplica `?select=` sobre
cualquier columna para la que el rol tenga privilegio. **Todos los GRANT son a nivel de
tabla, nunca de columna.**

| Ubicación | GRANT | Exposición |
|---|---|---|
| `init.sql:149` | `SELECT ON categorias, productos TO web_anon` | 🟢 solo catálogo |
| `init.sql:164` | `SELECT, UPDATE ON usuarios TO web_user` | 🔴 el usuario lee su fila completa, **incluido `password` y `google_id`** |
| `init.sql:176` | `ALL PRIVILEGES ON ALL TABLES TO web_admin` | 🔴 `GET /usuarios?select=email,password,google_id` **vuelca los hashes de todos los usuarios** |

**Matiz importante:** `?select=*&rol=eq.ADMIN` sobre `usuarios` de **otros** usuarios
sí está bloqueado por RLS (`init.sql:211-214` limita a la propia fila), pero (i) la
columna `rol` ajena no es filtrable, (ii) el `UPDATE` de `rol` **sí** pasa (C-2), y
(iii) no hay ningún filtro de columnas.

**Los claims sí llegan a la base** vía el GUC `request.jwt.claims`, y `sub` se usa
directamente como identidad en **5 políticas RLS** → el claim `sub` es el activo más
sensible del sistema, y con el secreto público de C-1 cualquiera puede escribirlo.

### 6.3 ALTOS

Ya documentados en §3: **T-3** (`eliminarProducto`), **T-4** (`startStandaloneServer`),
**T-5** (`NODE_ENV`), **T-6** (`Pedido.fecha` epoch-ms), **T-11** (Node), **T-1** (`.gitignore`).
Propios de esta rama:

#### `backend/` — validación de entrada ausente + fuga de mensajes de Postgres
No hay **un solo `if` de validación** en `resolvers.js` sobre los argumentos. Todo lo que
llega de GraphQL va directo a Postgres.

`resolvers.js:33` — `producto(id: "abc")`:
```js
producto: (_, { id }) => queryOne('SELECT * FROM productos WHERE id = $1', [id]),
```
`ID!` acepta cualquier string → Postgres lanza `invalid input syntax for type integer: "abc"`
→ se propaga como error GraphQL **con el mensaje crudo**, revelando tablas, columnas y el
esquema. Lo mismo con `precio: -5`, `stock: -100`, `nombre: ""` (string vacío) o
`categoriaId: "x"` en `crearProducto` (`:60-64`).

#### `backend/` — la secretaría de PostgREST está acoplada a mano a 4 archivos
`JWT_SECRET` (`.env.example:8`) ↔ `jwt-secret` (`postgrest.conf:26`) ↔
`authenticator_pw_dev` (`postgrest.conf:15` ↔ `init.sql:136`) ↔ `nexoplay_dev`
(`docker-compose.yml:9` ↔ `.env.example:3`).

Cuatro credenciales en cuatro archivos versionados, **sin fuente única ni mecanismo que
verifique que coinciden**. Y `docker-compose.yml:22-32` no tiene `env_file` para
`postgrest` — el acoplamiento es 100 % manual. **Deriva garantizada.**

### 6.4 MEDIOS (selección)

| # | Hallazgo | Evidencia |
|---|---|---|
| `backend` M-1 | **Sin rate limiting en ningún sitio.** `iniciarSesionGoogle` (`resolvers.js:139`) es pública y por llamada hace una verificación RSA de Google + 1-3 queries. Sin throttling por IP, por `sub`, ni captcha. | `src/resolvers.js:139` |
| `backend` M-2 | **JWT de 7 días, sin `iss`/`aud`/`jti`, sin revocación, sin refresh.** Si un ADMIN es degradado en la BD, sigue siendo ADMIN **hasta 7 días**. | `src/auth/jwt.js:4, 25-33` |
| `backend` M-3 | **La autoridad de autorización es el claim cacheado del JWT, no la base.** `context.js:16-23` construye `usuario` desde el payload sin releer la BD. `Number(payload.sub)` devuelve `NaN` si `sub` no es numérico. | `src/auth/context.js:16-23` |
| `backend` M-4 | **`Usuario.pedidos` es un IDOR latente:** no recibe `context` ni comprueba quién pregunta. Hoy no explotable, pero en cuanto exista `usuario(id:)` es un IDOR directo. | `src/resolvers.js:161-166` |
| `backend` M-5 | **TOCTOU en `buscarOCrearUsuarioGoogle`:** 3 viajes sin transacción. Dos logins simultáneos de un usuario nuevo → violación de `usuarios_email_key` sin manejar. Debería ser `INSERT ... ON CONFLICT ... RETURNING`. | `src/auth/google.js:42-66` |
| `backend` M-6 | **`id_token` de Google: no se valida `email_verified`, no hay `nonce`, hay replay.** Un `id_token` capturado se puede reproducir durante toda su vida (≤1 h). Posible login-CSRF. | `src/auth/google.js:17-30`; `LoginGoogle.jsx:31-32` |
| `backend` M-7 | **Vinculación de cuentas solo por email, sin re-autenticación** ni segundo factor. | `src/auth/google.js:48-59` |
| `backend` M-8 | **N+1 severo y peor que en `p26-back`.** `Query.pedidos` → 1 + 3N queries. `crearPedido` → 1 `SELECT` + 1 `INSERT` secuencial por renglón (**2N round-trips** dentro de la transacción). Colapsable a 2 con `WHERE id = ANY($1)` + un `INSERT ... SELECT ... FROM unnest(...)`. | `src/resolvers.js:39-48, 102-131` |
| `backend` M-9 | **Sin ningún índice** (ver T-8) | `db/init.sql` |
| `backend` M-10 | **Dinero: `NUMERIC` llega como string** (pg no registra el OID 1700) y se coacciona con `Number(...)`; `GraphQLFloat` lo absorbe pero `total` puede no coincidir con `sum(detalle.subtotal)`. | `src/resolvers.js:109, 179` |
| `backend` M-11 | **El comentario de `init.sql:220-222` miente sobre `web_admin`:** solo hay políticas `FOR SELECT`. `web_admin` tiene `ALL PRIVILEGES` pero **no hay política `FOR INSERT`/`UPDATE`/`DELETE`** → sus escrituras afectan **0 filas silenciosamente** (peor que un error: parece que funciona). Sin `ALTER DEFAULT PRIVILEGES` → una tabla futura queda sin `GRANT`. | `db/init.sql:220-222` |
| `backend` M-12 | **`init.sql` es destructivo y el header instruye a ejecutarlo a mano:** `DROP TABLE ... CASCADE` en `:20-24` + `psql -f db/init.sql` en `:13-14`. Cada ejecución **borra usuarios, pedidos y el admin**. Sin `DROP POLICY IF EXISTS`, un re-run parcial falla. Sin herramienta de migraciones: cualquier cambio de schema exige `docker compose down -v`. | `db/init.sql:13-14, 20-24` |
| `backend` M-13 | **`productos(limite)` y `Query.pedidos` sin tope.** `limite: 1000000` drena la tabla; `limite: -1` → `ERROR: LIMIT must not be negative` (error PG crudo al usuario). Sin `>= 0`, sin tope superior, sin `totalCount`. La lista de pedidos de ADMIN devuelve **todos** los pedidos de todos los usuarios, con PII. | `src/resolvers.js:31-32, 42` |
| `backend` M-14 | **`withTransaction` puede enmascarar el error original:** si `ROLLBACK` falla (conexión caída, statement en espera), se lanza el error nuevo, **se oculta la causa raíz** y el cliente queda inservible. Sin `statement_timeout`/`lock_timeout` el `ROLLBACK` puede bloquear indefinidamente. | `src/db.js:58-63` |
| `backend` M-15 | **`Producto.categoria: Categoria!` es no-null pero el resolver puede devolver `null`** (`queryOne` → `rows[0] ?? null`). La primera fila inconsistente anula toda la respuesta. | `src/schema.js:39` vs `resolvers.js:156-159` |
| `backend` M-16 | **El fail-fast de `index.js:16-18` no funciona como dice el comentario:** si `DATABASE_URL` está **ausente**, `new Pool({ connectionString: undefined })` cae a los defaults de pg, y el error será un fallo de autenticación, no "falta DATABASE_URL". Sin `pool.end()`. | `src/index.js:16-18` |
| `backend` M-17 | **Secretos duplicados a mano, sin `env_file`** (ver 6.3) | `docker-compose.yml:22-32` |
| `backend` M-18 | **`docker-compose.yml`: superficie de red y suministro.** `postgrest/postgrest:latest` **sin fijar versión**; `"5432:5432"` **publica Postgres a 0.0.0.0** con contraseña débil; `"3000:3000"` publica la superficie vulnerable de C-1..C-3; sin red dedicada, sin `read_only`, sin `cap_drop`, sin healthcheck, sin límites de recursos. | `docker-compose.yml:10-11, 23, 28-29` |
| `backend` M-19 | **Seed con credencial conocida en formato de hash falso**, y `password` es **columna muerta** (no hay login local). El `CHECK (password IS NOT NULL OR google_id IS NOT NULL)` se cumple trivialmente. | `db/init.sql:98-102, 58` |

### 6.5 BAJOS

- `import 'dotenv/config'` **duplicado** (`index.js:1` y `db.js:1`); los valores se leen en **tiempo de import** (`jwt.js:3`, `google.js:4`) → importar `resolvers.js` en un test sin `dotenv` revienta.
- `jwt.js:44` sin `{ algorithms: ['HS256'] }` y `jwt.js:33` sin `{ algorithm: 'HS256' }`. `jsonwebtoken@9` ya bloquea `none`, pero pinear el algoritmo es defensa en profundidad barata.
- `resolvers.js:136` — `SELECT` del pedido **fuera** de la transacción: round-trip extra y ventana de carrera.
- Sin `UNIQUE (pedido_id, producto_id)` en `detalle_pedido` → renglones duplicados sin consolidar.
- Sin `logger` estructurado: `console.error/log` crudo, sin request-id, sin `formatError` de Apollo, sin audit trail de las mutaciones ADMIN.
- `import 'dotenv/config'` llega tarde en `google.js`: el check `if (!CLIENT_ID)` (`:14-16`) se ejecuta **después** de `new OAuth2Client(undefined)` (`:5`).
- `Query.pedidos` de ADMIN usa `SELECT *` de todos los pedidos, sin vista agregada ni filtros.
- Caret muy amplios (`^8.13.0` cubre 8.0→8.x) sin `overrides` para transitivas.

### 6.6 Lo que está bien (crédito)

- ✅ **La verificación del `id_token` de Google es correcta y server-side** (`google.js:17-20`): valida firma contra el JWKS de Google, `aud`, `exp` e `iss`. **No se confía en el cliente.** Esto cierra el agujero más grave de la rama antigua.
- ✅ **El mapeo de rol de negocio → rol de Postgres se calcula en el servidor** (`jwt.js:23`), nunca a partir de algo que envíe el cliente.
- ✅ `jwt.verify` es una llamada real (`jwt.js:44`), y `jsonwebtoken@9` bloquea `alg:none` por defecto.
- ✅ **`requerirAdmin` en las 3 mutaciones de catálogo** (`resolvers.js:58, 68, 81`) — control de acceso real donde la rama antigua no tenía nada.
- ✅ **El IDOR de `usuarioId` está cerrado:** `resolvers.js:87-90` lo toma del JWT, y `schema.js:108-110` ya no lo pide en el input.
- ✅ **Cero inyección SQL:** `pg` con `$1..$n` en todas las consultas, verificado sin ninguna concatenación. Mismo nivel de garantía que la rama antigua.
- ✅ **`withTransaction` está bien construido:** cliente dedicado + `BEGIN`/`COMMIT`/`ROLLBACK` + `finally { release() }` (`db.js:46-64`).
- ✅ **El modelo de datos mejoró:** `NUMERIC(10,2)`, `TIMESTAMPTZ`, columnas OAuth2, `auth_provider` explícito en vez de inferir de `password IS NULL`.
- ✅ **Disciplina de diseño en `init.sql`:** el bloque de RLS está **fuera** del `BEGIN`/`COMMIT` (`:110` vs `:112+`), porque `CREATE ROLE` no puede ir dentro de una transacción. Los `CREATE ROLE` están guardados con `DO $$ IF NOT EXISTS`.
- ✅ `UNIQUE` en `usuarios.email` y `usuarios.google_id` salvan la integridad en la carrera de M-5.
- ✅ **Desaparece `better-sqlite3`** (binario nativo) y con él el bloque `allowScripts`. Las 6 dependencias son JS puro.
- ✅ **`package-lock.json` consistente** con `package.json`, 0 vulnerabilidades, `npm ci` seguro.

---

## 7. Rama nueva — `frontend-astro/` (Astro 5 SSR + islands React 18)

**~29 hallazgos: 3 CRÍTICO, 6 ALTO, ~10 MEDIO, ~10 BAJO**

### 7.1 Arquitectura

`astro.config.mjs:11-12`:
```js
output: 'server',
adapter: node({ mode: 'standalone' }),
```
**No hay nada pre-renderizado.** No existe `prerender = true` ni `getStaticPaths` en ninguna
página. El comentario de `astro.config.mjs:5-9` lo dice bien y es correcto.

| Superficie | Render | Datos |
|---|---|---|
| `index.astro`, `categoria/[id].astro`, `producto/[id].astro` | **SSR en Node, por petición** | `await graphqlRequest(...)` en el frontmatter |
| `carrito.astro` | SSR (solo el `<h1>`) | **Ninguno** — todo el carrito es cliente |
| `BaseLayout.astro:25-26` `LoginGoogle` / `CarritoResumen` | **isla `client:load`** | `localStorage` vía nanostores |
| `producto/[id].astro:44` `AgregarAlCarrito` | **isla `client:load`** | props serializadas por Astro |
| `carrito.astro:11` `CarritoCheckout` | **isla `client:load`** | `localStorage` + `sesion.token` |

→ **4 islas, todas `client:load` (hidratación eager).** Verificado: no existe `client:only`,
`client:idle`, `client:visible` ni `client:media`. Las dos islas del header se descargan e
hidratan **en todas las páginas**, incluidas las que no necesitan carrito.

**¿Cómo se comparte estado entre islas independientes?** El mecanismo **funciona**, y los comentarios
(`stores/carrito.js:4-8`, `BaseLayout.astro:23-24`) son técnicamente correctos:

1. `stores/carrito.js:9` — `persistentAtom('nexoplay:carrito', [], { encode, decode })` crea
   un **átomo a nivel de módulo**.
2. Astro compila todas las islas en un único build de Vite/Rollup. Rollup extrae los módulos
   alcanzados desde varios entry points a un **chunk compartido** → `stores/carrito.js` se
   evalúa **una sola vez** en el navegador.
3. `$carrito` es **una única instancia en memoria** compartida por las 3 islas cliente.
   `agregarAlCarrito()` en `/producto/1` actualiza el mismo átomo que lee `CarritoResumen`
   → **el badge se actualiza sin recargar**. ✅
4. Entre páginas: Astro **no** usa View Transitions; todos los enlaces son `<a href>` planos
   → cada navegación es **full reload**, y ahí `localStorage` sostiene el estado.

**¿El fetching se duplica?** No: SSR y cliente piden cosas distintas
(`QUERIES.categorias`/`producto` solo en servidor; `MUTATIONS.*` solo en islas). ✅
**Pero** `lib/graphql.js` no tiene rama server/client, así que **cualquier query nueva
escrita en ese archivo se ejecutará en el navegador por defecto** si la importa una isla,
y arrastrará `PUBLIC_GRAPHQL_URL` al bundle.

### 7.2 CRÍTICOS

Ya documentados en §3: **D-1** (JWT en `localStorage`), **D-2** (`localStorage` corrupto
tumba el sitio), **D-3** (doble submit → dos pedidos), **T-1** (`.gitignore`).

Añadido aquí, propio de esta rama:

#### `frontend-astro/` — la cantidad nunca se valida contra el stock (regresión del clamp perdido)

`stores/carrito.js:14-29`:
```js
export function agregarAlCarrito(producto, cantidad = 1) {
  const actual = $carrito.get();
  const existente = actual.find((r) => r.productoId === producto.id);
  if (existente) {
    $carrito.set(actual.map((r) =>
      r.productoId === producto.id ? { ...r, cantidad: r.cantidad + cantidad } : r
    ));
  } else {
    $carrito.set([...actual,
      { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad },
    ]);
  }
}
```

Dos problemas: **el renglón persiste sin `stock`** (línea 26) y **`agregarAlCarrito` suma sin
tope** (línea 20). El `max` del input (`AgregarAlCarrito.jsx:22`) es **decorativo**: `max` en
`<input type="number">` no impide escribir — el navegador marca el campo inválido pero
`onChange` **sigue recibiendo el valor crudo** (`AgregarAlCarrito.jsx:24` solo clampea el
*mínimo*: `Math.max(1, Number(e.target.value))`).

**Con `producto.stock = 2`:** escribir `9999` → `cantidad = 9999` → el carrito guarda
`cantidad: 9999` → `CarritoCheckout.jsx:26` lo envía crudo → el backend lo acepta (T-2).
**Se pueden comprar 1000 unidades de un producto con stock 15.**

**El front viejo SÍ clampeaba** (`p26-front/src/context/CarritoContext.jsx:41-42`):
```js
const maximo = it.producto.stock ?? cantidad;
const clamped = Math.min(Math.max(cantidad, 1), maximo);
```
**Regresión funcional directa, causada por el cambio de shape del store** (de
`{producto, cantidad}` a una lista aplanada sin `stock`) **y por la pérdida de
`actualizarCantidad`**.

### 7.3 ALTOS

| # | Hallazgo | Evidencia |
|---|---|---|
| `frontend-astro` A-1 | **Un solo fallo de GraphQL borra la home completa.** `Promise.all` es all-or-nothing: si `productos` falla, `categorias` también se descarta aunque haya llegado bien → la sección "Categorías" se renderiza vacía junto al mensaje de error. El front viejo lo hacía deliberadamente al revés, con `errorCategorias` y `errorProductos` independientes. **Regresión.** | `pages/index.astro:14-19` |
| `frontend-astro` A-2 | **`Astro.redirect('/404')` a una ruta inexistente, y HTTP 200 en errores.** No existe `src/pages/404.astro` → un **302 hacia `/404`**. Y cuando el backend falla **por red** (no el recurso), la página se sirve con **HTTP 200** mostrando "No se pudo cargar el producto: Error de red (500)". Sitemaps, logs y SLOs no lo detectan. | `pages/categoria/[id].astro:16-18`; `pages/producto/[id].astro:17-19` |
| `frontend-astro` A-3 | **Los estilos de `CarritoCheckout` desaparecen en 2 de 3 estados.** El componente tiene 3 `return`, pero el bloque `<style>` (`:109-120`) está **solo en el tercero**. `.carrito-vacio` y `.checkout-ok` se definen únicamente ahí → tras confirmar un pedido, la pantalla de éxito aparece **sin centrar y sin padding**; el carrito vacío también. | `components/CarritoCheckout.jsx:38-68` vs `:109-120` |
| `frontend-astro` A-4 | **`.gitignore` raíz vacío → `frontend-astro/.env` commiteable**, con `PUBLIC_GOOGLE_CLIENT_ID`. `.env.example:8` instruye a pegar el client ID real ahí. | `.gitignore` raíz |
| `frontend-astro` A-5 | **Regresión fuerte de accesibilidad:** **cero `role="alert"`** en toda la app (el viejo los tenía en 4 sitios), **cero estilos `:focus`** (el viejo tenía 2 reglas), y **una sola ocurrencia de `aria-label`** en toda la app. Se perdieron los botones `+`/`−` operables por teclado del `DetalleProducto` viejo. | grep `role="alert"` → 0; grep `aria-` → 1 |
| `frontend-astro` A-6 | **El topbar no tiene ningún media query y desborda en móvil.** `.topbar__inner` es flex con logo + nav + `LoginGoogle` (avatar + **nombre completo sin truncar** + "Salir") + `CarritoResumen`. Un nombre de Google largo rompe el layout; no hay `min-width: 0` ni `text-overflow: ellipsis`. El viejo tenía `flex-shrink: 0`. | `layouts/BaseLayout.astro:49-55`; `LoginGoogle.jsx:66, 71` |
| `frontend-astro` A-7 | **`NaN`/decimales en el input de cantidad → carrito corrupto.** `Number('abc')` → `NaN` → `Math.max(1, NaN)` → `NaN` → `JSON.stringify({cantidad: NaN})` → **`"cantidad": null`** en `localStorage` → el `total` se vuelve `NaN` → `total.toFixed(2)` renderiza literalmente `"NaN"`. Y `Number('1.5')` → `1.5` → **error de coerción GraphQL** contra `cantidad: Int!`. Falta `step={1}` y guard `Number.isFinite`. | `components/AgregarAlCarrito.jsx:24` |
| `frontend-astro` A-8 | **El cliente llama al backend directamente → depende del CORS abierto del backend.** `lib/graphql.js:11` llama `http://localhost:4001/` desde el navegador. Funciona **solo** porque `backend/index.js:20` usa `startStandaloneServer` con `cors()` sin argumentos (T-4). Si alguien endurece el CORS — lo correcto en producción — **las islas se rompen** sin que el SSR avise: las páginas se ven bien, solo fallan al comprar. | `lib/graphql.js:5, 11` |

### 7.4 MEDIOS

| # | Hallazgo | Evidencia |
|---|---|---|
| `frontend-astro` M-1 | **`setTimeout` sin cleanup** en `AgregarAlCarrito.jsx:14` → `setState` sobre componente desmontado, timers apilados en clics seguidos, y el primero apaga el feedback antes de que el segundo termine su ventana. | `components/AgregarAlCarrito.jsx:14` |
| `frontend-astro` M-2 | **Flash de carrito vacío en cada carga, y `/carrito` inservible sin JS.** El SSR no puede conocer `localStorage`, así que el HTML **siempre** es la versión vacía. Sin JS, con un crawler, o antes de la hidratación, la página dice "Tu carrito está vacío" aunque el usuario tenga 5 productos. | `CarritoResumen.jsx:9-15`; `carrito.astro:8-10` |
| `frontend-astro` M-3 | **`<img src={p.imagen}>` sin fallback con `imagen` nullable.** `schema.js:36` declara `imagen: String` (nullable). Con `imagen = null` → `<img src="null">` → 404 contra el propio servidor Astro; con `imagen = ''` → el navegador **re-pide la página actual como imagen**. El front viejo tenía un componente entero para esto (`ImagenProducto.jsx:11-14`). **Regresión.** | `index.astro:55`; `categoria/[id].astro:32`; `producto/[id].astro:33` |
| `frontend-astro` M-4 | **Doble montar del script de Google en cada login/logout.** El efecto depende de `sesion`; cada ciclo añade un `<script>`. El cleanup quita el elemento del DOM pero **nunca llama `google.accounts.id.cancel()`** ni des-registra el `initialize`. El singleton es global: la 2ª llamada sobrescribe el callback, pero el `renderButton` de la 1ª sigue en el nodo viejo → tras un logout→login el botón puede dejar de aparecer. | `components/LoginGoogle.jsx:24-58` |
| `frontend-astro` M-5 | **Contraste WCAG AA fallido en 12+ sitios** (ver anexo B). Los tokens son idénticos a los del viejo pero el **contexto cambió**: el viejo pintaba `--texto-secundario` casi siempre sobre blanco (4.76:1 ✅); el nuevo lo movió a `--surface-muted` (**4.34:1 ❌**). Deuda arrastrada **y agravada**. | `styles/tokens.css`; `BaseLayout.astro:79` |
| `frontend-astro` M-6 | **Error de auth indistinguible de un error de red.** Cuando el token caduca, `CarritoCheckout.jsx:32` muestra "Necesitas iniciar sesion" como si fuera un error genérico, pero **el botón "Confirmar pedido" sigue visible** (`:93` solo comprueba `sesion !== null`). El usuario ve un error que no puede resolver sin descubrir el "Salir" del header. | `components/CarritoCheckout.jsx:32, 93-96` |
| `frontend-astro` M-7 | **Se filtra el mensaje crudo del backend** al usuario, ahora también **en el HTML del servidor** (no solo tras la hidratación). | `lib/graphql.js:18, 23`; `index.astro:34` |
| `frontend-astro` M-8 | **Sin timeout ni `AbortController` en el fetch.** Un backend colgado **cuelga el render SSR indefinidamente**, ocupando una conexión del servidor. Con `output: 'server'`, un pod colgado agota el pool. Sin `cache: 'no-store'` tampoco. | `lib/graphql.js:11-15` |
| `frontend-astro` M-9 | **`lib/graphql.js:5` — fallback silencioso a `localhost:4001`.** Sin `.env`, el servidor funciona por casualidad y el navegador de cualquier otro usuario apunta a **su propio** `localhost`. Fallo total con un error confuso. | `lib/graphql.js:5` |
| `frontend-astro` M-10 | **La paginación fue eliminada, no resuelta.** Se borró `QUERIES.productosPaginados` y con ella el botón "Cargar más". La home **muestra siempre 8 productos y no hay forma de ver el resto del catálogo**. Con datos reales el 90 % del catálogo es inalcanzable. | `pages/index.astro:16`; `lib/graphql.js` |

### 7.5 BAJOS (selección)

- **Paginación/skeleton/error-boundary ausentes:** no hay `Skeleton` (el viejo tenía), no hay botón de reintentar en ningún error, no hay `aria-busy`, no hay estado vacío en categoría.
- **`key={i}`** en `CarritoCheckout.jsx:46-47` (riesgo bajo: lista inmutable) — debería ser `key={d.producto.id}`.
- **CSS duplicado ×3:** ~40 líneas de `.grid-productos` / `.tarjeta-producto` / `.error` / `h1` repetidas en `index.astro`, `categoria/[id].astro`, `producto/[id].astro` y `carrito.astro`. Astro auto-scopea los `<style>`, pero los `<style>` dentro de los `.jsx` **son globales**.
- **Tokens muertos:** `--cian`, `--dark`, `--exito`, `--advertencia` y `.visually-hidden` **nunca usados** (el viejo sí los usaba).
- **Comentarios factualmente incorrectos:** `carrito.astro:8-10` dice *"toda esta pagina es una sola isla"* (son 3); `LoginGoogle.jsx:14-16` **normaliza un anti-patrón de seguridad** al señalar que las islas podrían hablar con PostgREST directamente.
- **`QUERIES.categorias` pide `productos { id }` de todas las categorías solo para contar** en `index.astro:44` → payload desperdiciado + N+1 en el backend.
- **4 estilos inline** que contradicen el sistema de tokens: `carrito.astro:6`, `LoginGoogle.jsx:79, 85, 86`.
- **Falta `<link>` a las fuentes:** `tokens.css:15-16` declara Poppins e Inter, pero `BaseLayout.astro:10-14` **no carga ninguna** → todo cae al `sans-serif` del sistema. **Regresión visual**: el diseño de marca no se está viendo.
- **Falta favicon** (el viejo tenía `public/favicon.svg`), `<meta name="description">` y Open Graph.
- **No hay `README.md` en `frontend-astro/`** (el viejo tenía uno de 4.4 KB).
- **`key={i}`** en listas `.map()` de `.astro` no es bug (Astro no reconcilia listas).

### 7.6 Lo que está bien (crédito)

- ✅ **La arquitectura híbrida SSR + islands es la mejor decisión del proyecto.** El catálogo llega en el primer HTML, sin waterfall JS→fetch→render.
- ✅ **El mecanismo de estado compartido entre islas funciona** y está bien documentado (§7.1).
- ✅ **El carrito ahora sobrevive al F5** (`persistentAtom` → `localStorage`). El viejo lo mantenía en `useState` (`CarritoContext.jsx:11`) sin persistencia → **se perdía en cada recarga**.
- ✅ **Se eliminó el ID de usuario hardcodeado.** `p26-front/src/templates/Checkout.jsx:14` tenía `const USUARIO_ID_FIJO = '2'` — cualquiera compraba como el usuario 2. **Es la mejora de seguridad más importante del rewrite.**
- ✅ **Login real con Google Identity Services**, con el ID token verificado server-side y JWT propio emitido. El viejo **no tenía autenticación whatsoever**.
- ✅ **Estado de error de auth explícito** en `CarritoCheckout.jsx:93-96` en vez de mandar un `usuarioId` falso.
- ✅ **Cero XSS sinks** (verificado por grep: sin `set:html`, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write`).
- ✅ **Landmarks semánticos** (`<header>/<nav>/<main>/<footer>`) frente al `<div class="app-shell">` del viejo.
- ✅ **La mutation funciona:** usa `$d: PedidoInput!` correctamente y el backend acepta `detalles` sin `usuarioId` (`schema.js:108-110`). Verificado contra el schema real.
- ✅ **Jerarquía de encabezados correcta** en `index.astro` y `carrito.astro`.
- ✅ **Cero `TODO`/`FIXME`** en el código (el viejo tenía un `TODO-P2-6-NexoPlay.md` entero).
- ✅ `frontend-astro/package-lock.json` **sí** está trackeado en git.

---

## 8. Matriz: heredado, regresión y nuevo

### 8.1 Backend — `p26-back` → `backend/`

| Aspecto | Veredicto | Detalle |
|---|---|---|
| Autenticación | ✅ **MEJORÓ (decisivo)** | Ninguna → Google OAuth verificado server-side + JWT propio |
| IDOR de `usuarioId` | ✅ **MEJORÓ** | Abierto → cerrado (`resolvers.js:87-90`) |
| Autorización | ✅ **MEJORÓ** | Ninguna → `requerirAdmin` en las 3 mutaciones de catálogo |
| Inyección SQL | ⚪ igual | Prepared statements → `$1..$n`. Mismo nivel |
| Transacciones | ⚪ igual | `db.transaction()` → `BEGIN/COMMIT/ROLLBACK` correcto |
| Modelo de datos | ✅ **MEJORÓ** | `REAL`/`TEXT` → `NUMERIC(10,2)`/`TIMESTAMPTZ`/OAuth |
| Dependencias | ✅ **MEJORÓ** | Desaparece `better-sqlite3` (binario nativo) y `allowScripts` |
| Arranque | ✅ mejoró | Auto-init de BD → `await pool.query('SELECT 1')` (con matices) |
| Concurrencia | ⚠ **EMPEORÓ** | Monohilo (serialización gratis) → pool async de 10 (**se perdió** la serialización) |
| **`Pedido.fecha`** | 🔴 **EMPEORÓ** | String correcto → **epoch-ms como string** (T-6) |
| **Superficie de ataque** | 🔴 **EMPEORÓ** | 1 origen (GraphQL) → **2** (GraphQL + PostgREST), con permisos *más amplios* |
| **RLS** | 🔴 **EMPEORÓ** | Se añade RLS pero **no protege el camino GraphQL** (superusuario) |
| `.gitignore` | 🔴 **EMPEORÓ** | Existía y era correcto → raíz vacía, `backend/` sin el suyo |
| Coste de operación | 🔴 **EMPEORÓ** | `npm start` → Docker + 2 contenedores + 4 secretos en 4 archivos |
| Validación de entrada | ⚪ igual (peor) | Ninguna → ninguna, pero ahora fuga mensajes de Postgres **y stack traces** |
| N+1 | 🔴 **EMPEORÓ** | 1+N en categorías → **1+3N** en pedidos, más 2N en `crearPedido` |
| Sin stock | ⚪ **igual (heredado)** | T-2, idéntico |
| `eliminarProducto` roto | ⚪ **igual (heredado)** | T-3, idéntico |
| Recursión del schema | 🔴 **EMPEORÓ** | Ciclo igual, pero más peligroso: pool limitado + queries públicas sin rate limit |
| Validación de `limite` | ⚪ igual | `null` crashea en el viejo; en el nuevo `null` → 500 de Postgres. Mismo bug, distinto síntoma |

### 8.2 Frontend — `p26-front` → `frontend-astro/`

| Aspecto | Veredicto | Detalle |
|---|---|---|
| Arquitectura | ✅ **MEJORÓ** | Router de máquina de estados → SSR + islands con URLs reales |
| Autenticación | ✅ **MEJORÓ (decisivo)** | Ninguna → Google OAuth real |
| `USUARIO_ID_FIJO` hardcodeado | ✅ **ELIMINADO** | La mejora de seguridad más importante del rewrite |
| Persistencia del carrito | ✅ **MEJORÓ** | Se perdía en cada F5 → `persistentAtom` |
| Primera carga | ✅ **MEJORÓ** | Waterfall JS→fetch→render → catálogo en el primer HTML |
| Landmarks semánticos | ✅ **MEJORÓ** | `<div class="app-shell">` → `<header>/<nav>/<main>/<footer>` |
| Detalles en la confirmación | ✅ **MEJORÓ** | `{id, total, status}` → incluye `detalles { cantidad subtotal producto { nombre } }` |
| Estado compartido | ✅ **MEJORÓ** | `CarritoProvider` envolviendo todo el árbol → módulo singleton |
| **Accesibilidad** | 🔴 **REGRESIÓN FUERTE** | 4 `role="alert"` + 2 `:focus` + `visually-hidden` + botones `+`/`−` operables → **todo a cero** |
| **Contraste WCAG** | 🔴 **REGRESIÓN** | Tokens idénticos, pero peor contexto de uso: 12+ sitios fallan AA |
| Clamp de stock | 🔴 **REGRESIÓN** | `agregarAlCarrito` clampeaba (parcialmente) → **ya no clampa y ni guarda `stock`** |
| Doble submit del checkout | 🔴 **EMPEORÓ** | Ya existía → ahora **materializa 2 pedidos reales** (sin validación de stock) |
| Paginación | 🔴 **REGRESIÓN** | Botón "Cargar más" → **eliminado**; 90 % del catálogo inalcanzable |
| Estados de carga | 🔴 **REGRESIÓN** | `Skeleton.jsx` con `aria-busy` → eliminados, sin `aria-busy` |
| Botón de reintentar | 🔴 **REGRESIÓN** | 4 pantallas → **ninguna** |
| Confirmación antes de quitar | 🔴 **REGRESIÓN** | Inline "¿Quitar? Sí/No" → **eliminado**, un misclick borra la línea |
| Componente `ImagenProducto` | 🔴 **REGRESIÓN** | Placeholder con `aria-hidden` + fallback → **eliminado**, `src={null}` → 404 |
| Fuentes web | 🔴 **REGRESIÓN** | Poppins + Inter cargadas en `index.html:7-9` → **`tokens.css` las declara pero no se cargan** |
| Responsive | ⚠ **EMPEORÓ** | 4 media queries + `flex-shrink: 0` → 1 media query, ninguno en el topbar, ningún `flex-shrink` |
| Error handling | 🔴 **REGRESIÓN** | `errorCategorias`/`errorProductos` independientes → `Promise.all` todo-o-nada |
| Linter | 🔴 **REGRESIÓN** | `oxlint` + `.oxlintrc.json` + `npm run lint` → **eliminado** |
| `"private": true` | 🔴 **REGRESIÓN** | Presente → ausente |
| React | ⚪ **REGRESIÓN** | React 19.2 → **React 18.3** (downgrade; los `^18.3.1` no permiten subir sin tocar el lock) |
| `devDependencies` | 🔴 **EMPEORÓ** | Separadas → **todo en `dependencies`**, incluidas `astro` y los adapters. `npm ci --omit=dev` no puede buildear |
| `"start"` | 🟡 ambiguo | `"start": "astro dev"` duplica `"dev"`; evoca producción y arranca el servidor de desarrollo |

### 8.3 Los 8 patrones que el rewrite arrastró sin corregir

Estos bugs **existen en ambas ramas** y son los que más esfuerzo costarán si no se
abordan una sola vez:

1. **Sin validación de stock** en `crearPedido` (T-2)
2. **`eliminarProducto` roto por FK** (T-3)
3. **`startStandaloneServer` sin endurecer** (T-4): CORS `*`, 50 MB, sin depth limit
4. **`NODE_ENV` sin definir** (T-5): introspection y stack traces siempre activos
5. **Cero índices** en el schema (T-8)
6. **Dinero en punto flotante** (T-7)
7. **Passwords de seed que simulan hash** (T-12)
8. **`.gitignore` raíz vacío** (T-1) — empeorado, no corregido

---

## 9. Top 15 de remediación

Ordenado por severidad y dependencia. **Ninguno de estos cambios fue aplicado.**

### Bloque 1 — Cerrar los críticos explotables (nueva rama)

| # | Acción | Archivos | Bloquea |
|---|---|---|---|
| 1 | Sacar `jwt-secret` de `postgrest.conf`; inyectar con `${JWT_SECRET}` + `env_file` en `docker-compose.yml`, y **abortar el arranque si es el placeholder** | `backend/postgrest.conf:26`, `docker-compose.yml:22-32`, `backend/.env.example:8` | C-1 |
| 2 | `REVOKE UPDATE (rol, password, google_id, auth_provider) ON usuarios FROM web_user` + `GRANT UPDATE (nombre, avatar_url)`. Añadir `WITH CHECK (rol = <rol actual>)` explícito | `backend/db/init.sql:164, 215-218` | C-2 |
| 3 | `REVOKE INSERT ON pedidos, detalle_pedido FROM web_user` (el alta solo por `crearPedido`) **o** un `db-pre-request` que fije `total`/`status`/`precio_unitario` | `backend/db/init.sql:163`, `backend/postgrest.conf` | C-3 |
| 4 | Decremento atómico de stock dentro de la transacción: `UPDATE productos SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING stock`; si `rows.length === 0` → `throw`. **En los dos backends.** + `CHECK (cantidad > 0)`, `CHECK (stock >= 0)`, `CHECK (total >= 0)` | `backend/src/resolvers.js:102-115`, `p26-back/src/resolvers.js:98-105`, ambos `*.sql` | T-2 |
| 5 | Dejar de usar `POSTGRES_USER` como rol de la app: crear un `nexoplay_app` con `NOSUPERUSER` y `GRANT`s mínimos, para que la RLS **sí aplique** al camino GraphQL | `docker-compose.yml:8-9`, `backend/.env.example:2-3`, `db/init.sql` | §6.2 |
| 6 | `decode` seguro en ambos stores: `try { const v = JSON.parse(txt); return Array.isArray(v) ? v : [] } catch { return [] }`, validar `{token, usuario}` en `$sesion`, y añadir un `ErrorBoundary` de React en cada isla | `frontend-astro/src/stores/carrito.js:9-12`, `stores/sesion.js:7-10`, 4 `.jsx` | D-2 |
| 7 | **Migrar el JWT de `localStorage` a cookie httpOnly**: `Astro.cookies.set('token', jwt, { httpOnly: true, secure: true, sameSite: 'lax' })` + `Astro.middleware` que inyecte el `Authorization` **en el servidor**. Beneficios: XSS no puede robarlo, el SSR **sí** conoce al usuario, y "Mis pedidos" deja de necesitar ser una isla | `frontend-astro/src/stores/sesion.js:7-14`, `BaseLayout.astro`, nuevo `src/middleware.js` | D-1 |
| 8 | Guarda de idempotencia en el checkout: ref `if (enviandoRef.current) return;` + **clave de idempotencia enviada al backend** (`INSERT ... ON CONFLICT`) | `CarritoCheckout.jsx:20-36`, `backend/src/resolvers.js:86-137` | D-3 |

### Bloque 2 — Endurecer el servidor (ambas ramas)

| # | Acción | Archivos |
|---|---|---|
| 9 | Salir de `startStandaloneServer` por `express` propio: `cors({ origin: [...] })`, `bodyParser.json({ limit: '100kb' })`, `helmet`. Agregar `maxRecursiveSelections` o un límite de profundidad como `validationRules` | `p26-back/index.js:15`, `backend/index.js:20` (T-4) |
| 10 | Fijar `NODE_ENV=production`, `includeStacktraceInErrorResponses: false`, `introspection: false`, y un `formatError` que **no** filtre mensajes de Postgres/SQLite | ambos `index.js` (T-5) |
| 11 | Llenar el `.gitignore` raíz y añadir `backend/.gitignore` y `frontend-astro/.gitignore` | `.gitignore` (T-1) |
| 12 | Scalar `DateTime` (`serialize: d => d instanceof Date ? d.toISOString() : d`) y `fecha: DateTime!` | `backend/src/schema.js:67`, `resolvers.js:172` (T-6) |
| 13 | Rate limit en `iniciarSesionGoogle` y en las mutations; `REVOKE SELECT (password, google_id)` para PostgREST; GRANTs a nivel de columna; completar las políticas RLS de `web_admin` (`INSERT`/`UPDATE`/`DELETE`); `ALTER DEFAULT PRIVILEGES` | `backend/db/init.sql:164, 176, 220-222` |

### Bloque 3 — Corregir los bugs de UX de la rama antigua

| # | Acción | Archivos |
|---|---|---|
| 14 | `verProducto` debe setear `categoriaId`; y `DetalleProducto` debe devolver `categoria.id` al flujo. **Añadir tests de tabla para `maquina()`** — es una función pura y habría atrapado este bug y el de `volverAProducto` ambiguo | `p26-front/src/App.jsx:23-50`, `DetalleProducto.jsx:72` (B-1) |
| 15 | Ordenar `vaciarCarrito()` **después** de la redirección (o mover el carrito a nanostores con una única fuente de verdad), y añadir idempotencia al backend | `p26-front/src/templates/Checkout.jsx:85-92` (B-2) |

### Backlog de mejora de calidad

- **16.** Clamp de stock en el carrito de `frontend-astro` (guardar `stock` en el renglón, clampear en `agregarAlCarrito`, `step={1}`, `Number.isFinite`).
- **17.** `Promise.allSettled` + estado de error por sección en `index.astro`; crear `404.astro`; `Astro.response.status = 404`/`= 502` en vez de redirect.
- **18.** Restaurar accesibilidad en `frontend-astro`: `role="alert"` en los 4 mensajes de error, `:focus-visible` en enlaces y botones, `visually-hidden` en los controles de icono, y recuperar los botones `+`/`−` con `aria-label`.
- **19.** Oscurecer `--texto-secundario` (`#64748b` → `#475569`, ~7:1) y `--error` (`#ef4444` → `#b91c1c`, ~6:1); cambiar `.boton--primario:disabled` a un gris con contraste suficiente.
- **20.** Migrar dinero a enteros en centavos o a un scalar `Decimal`; añadir `UNIQUE (pedido_id, producto_id)`.
- **21.** Crear los 4 índices faltantes en los dos schemas.
- **22.** Reintroducir linter + `engines` + `"private": true` en los 4 `package.json`; mover las herramientas de build a `devDependencies` en `frontend-astro`.
- **23.** Corregir rangos mal declarados: `graphql: "^16.11.0"` (el `^16.9.0` viola el peer de Apollo 5).
- **24.** Reescribir el README raíz para que describa la estructura real, y crear `frontend-astro/README.md`.
- **25.** Añadir un `ErrorBoundary` en `p26-front`; usar `useMemo` en el `value` del Context.
- **26.** Introducir un sistema de migraciones (en vez de `DROP TABLE` + re-ejecución manual) en `backend/db/`.
- **27.** Tests + CI. Mínimo: una prueba de integración por resolver de cada backend, y los casos de tabla de `maquina()`.

---

## 10. Anexos

### Anexo A — Auditoría de dependencias

| Proyecto | Lock consistente | `npm audit` | Observaciones |
|---|---|---|---|
| `p26-back` | 🟢 `lockfileVersion 3`, 0 entradas sin `resolved`, `node_modules` coincide con el lock | 🟢 **0 vulnerabilidades** | `graphql: "^16.9.0"` viola el peer de Apollo 5 (`^16.11.0`); `dotenv` 1 major atrás |
| `p26-front` | 🟢 commiteado | 🟢 sin vulnerabilidades | `@types/react` y `@types/react-dom` en un proyecto **JS puro** sin `tsconfig.json` (peso muerto) |
| `backend` | 🟢 consistente | 🟢 sin vulnerabilidades | Sin `devDependencies` (ni linter ni test); `^8.13.0` muy amplio sin `overrides` |
| `frontend-astro` | 🟢 commiteado | 🟢 sin vulnerabilidades | 🔴 **8 deps, 0 `devDependencies`**: `astro`, `@astrojs/react` y `@astrojs/node` están en `dependencies`. `npm ci --omit=dev` **no puede buildear** |

**Riesgo de suministro principal fuera de npm:** `docker-compose.yml:23` usa
`postgrest/postgrest:latest` **sin fijar versión** — una actualización puede romper la
config o cambiar el comportamiento de `SET ROLE` sin aviso.

### Anexo B — Contraste WCAG 2.1 AA

Ratios calculados con la fórmula de luminancia relativa. Mínimo AA para texto normal: **4.5:1**.

#### Rama nueva — `frontend-astro/`

| Fondo | Texto | Ratio | AA | Ubicación |
|---|---|---|---|---|
| `#f1f5f9` | `#64748b` `--texto-secundario` | **4.34:1** | ❌ | `BaseLayout.astro:79` (footer), `categoria/[id].astro:46`, `producto/[id].astro:59,74`, `CarritoCheckout.jsx:115,117`, `LoginGoogle.jsx:79` |
| `#ffffff` | `#64748b` `--texto-secundario` | 4.76:1 | ✅ | justo al límite |
| `#f1f5f9` | `#ef4444` `--error` | **3.44:1** | ❌ | `index.astro:111`, `categoria/[id].astro:66`, `producto/[id].astro:75`, `CarritoCheckout.jsx:118`, `LoginGoogle.jsx:86` |
| `#ffffff` | `#ef4444` `--error` | **3.76:1** | ❌ | `tokens.css:90-92` → `.boton--peligro` (botón "Quitar", 14 px/600) |
| `#c4b5fd` (disabled) | `#ffffff` | **1.85:1** | ❌❌ | `tokens.css:69-72` — "Sin stock" y "Confirmar compra" deshabilitado |
| `#f1f5f9` | `#5b21b6` `--violeta` | 8.20:1 | ✅ AAA | — |
| `#5b21b6` | `#ffffff` | 8.98:1 | ✅ AAA | — |

**Tokens muertos que además fallarían:** `--exito: #22c55e` (2.08:1), `--advertencia: #f59e0b` (1.96:1), `--cian: #06b6d4` (2.22:1), `--dark: #0f172a` (7.35:1 ✅ pero no usado).

**Ausencia total:** `grep --focus|outline|prefers-reduced-motion` → **0 coincidencias** de
estilos de foco. El anillo del navegador sigue activo (nadie hace `outline: none`), pero el
topbar es `position: sticky; z-index: 10` (`BaseLayout.astro:45-47`), así que los elementos
focuseados cerca del tope pueden quedar **tapados por la barra**.

**Rama antigua — `p26-front/` (para comparación)**

| Par | Ratio | AA | Ubicación |
|---|---|---|---|
| blanco / `#c4b5fd` (disabled) | **1.85:1** | ❌❌ | `tokens.css:69-72` — **idéntico, deuda compartida** |
| `--cian #06b6d4` / blanco | **2.43:1** | ❌ | `index.css:435-440` |
| `--exito #22c55e` / blanco | **2.28:1** | ❌ | `index.css:456-460` |
| `rgba(255,255,255,.45)`→`#7b7f8a` / `--dark` | **4.46:1** | ❌ (por 0.04) | `index.css:619-621` |
| `#64748b` / `#f1f5f9` | **4.34:1** | ❌ | `tokens.css:10` — **idéntico, deuda compartida** |
| `--violeta #5b21b6` / blanco | 8.98:1 | ✅ AAA | `tokens.css:86` |
| `#0f172a` / `#f1f5f9` | 16.30:1 | ✅ AAA | `index.css:57-60` |

**Los dos `:root` son idénticos** — el mismo `:root` se copió de un proyecto a otro. Lo que
cambió fue el **contexto de uso**: el viejo pintaba `--texto-secundario` sobre blanco
(4.76:1 ✅); el nuevo lo movió a `--surface-muted` (4.34:1 ❌).

#### Elementos accesibles que la rama nueva perdió

| Capacidad | Rama antigua | Rama nueva |
|---|---|---|
| `role="alert"` | 4 sitios (`ErrorMessage.jsx:6`, `Checkout.jsx:169`, `Home.jsx:75,95`, `DetalleCategoria.jsx:37`, `DetalleProducto.jsx:51`) | ❌ **0** |
| `:focus` explícito | 2 reglas (`index.css:69-72`, `:588-593`) | ❌ **0** |
| `.visually-hidden` | 4 usos (`TopBar.jsx:20`, `Carrito.jsx:24`, `DetalleProducto.jsx:92`, `TopBar.jsx:19`) | ❌ 0 usos (el token existe pero nadie lo usa) |
| `aria-label` | 6+ sitios | **1** (`AgregarAlCarrito.jsx:26`) |
| Botones `+`/`−` con `aria-label` | ✅ operables por teclado | ❌ reemplazados por `<input type="number">` (soporte inconsistente en lectores de pantalla) |
| Emoji decorativo con `aria-hidden` | ✅ `TopBar.jsx:30`, `Hero.jsx:12-15` | ❌ `CarritoResumen.jsx:14` anuncia el emoji |
| `<nav aria-label>` | ✅ `Sidebar.jsx:7` | ❌ `BaseLayout.astro:19` sin label |
| `<h3>` en tarjetas de producto | ✅ `ProductoCard.jsx:18` | ❌ `<span>` (`index.astro:57`, `categoria/[id].astro:34`) — **el outline perdió un nivel** |
| Skip link | ❌ | ❌ (y `<main>` no tiene `id`, `BaseLayout.astro:31`) |

### Anexo C — Verificaciones empíricas realizadas

Todas reproducibles, sin dejar residuos en el repositorio.

| Hipótesis | Resultado |
|---|---|
| `LIMIT NULL` con `better-sqlite3` | `SQLITE_MISMATCH: datatype mismatch` ✅ |
| `st.all()` sin argumentos | `Too few parameter values were provided` ✅ |
| `DELETE` de producto con `detalle_pedido` (sin CASCADE) | `SQLITE_CONSTRAINT_FOREIGNKEY` ✅ |
| `DELETE` con FK CASCADE | OK ✅ (control) |
| `foreign_keys` off → `INSERT` con padre inexistente | pasa silenciosamente ✅ (justifica `db.js:13`) |
| `cors()` sin args en `startStandaloneServer` | `standalone/index.js:19` → `origin: '*'` ✅ |
| Body limit por defecto | `standalone/index.js:32` → `'50mb'` ✅ |
| `validationRules` por defecto | `requestPipeline.js:108` → array vacío ✅ |
| Graceful shutdown en Apollo 5 | sin `process.on('SIGTERM'/'SIGINT')` ✅ |
| `DB_PATH` relativo vs `__dirname` | `db.name` devuelve la ruta **cruda** → se resuelve vs `cwd` ✅ |
| `NODE_ENV` no definido → introspection | `ApolloServer.js` → `isDev = true` ✅ |
| `pg` parsea `timestamptz` a `Date` | `pg-types/lib/textParsers.js` → `register(1184, parseDate)` ✅ |
| `GraphQLString.serialize(Date)` | `valueOf()` → epoch-ms como string ✅ |
| `pg` parsea `numeric` a string | OID 1700 sin registrar ✅ |
| `GraphQLFloat.serialize("8841.00")` | coacciona a número ✅ (`scalars.js:143-145`) |
| Apollo 5 `peerDependencies` de `graphql` | `^16.11.0` vs `^16.9.0` declarado ✅ |
| `oxlint` configurado y funcional | 0 errores, **3 warnings** ✅ (ejecutado) |
| `resolvers.js` sin ningún `await` perdido | verificado ✅ (el problema es `await` en bucle secuencial) |
| `frontend-astro` sin sumideros XSS | 0 coincidencias ✅ |
| `.env` en el historial | ninguno, solo 4 `.env.example` ✅ |
| `.gitignore` raíz | 0 bytes; `backend/.env` **NO IGNORED** ✅ |
| `jwt-secret` == placeholder de `.env.example` | **idénticos** ✅ |
| `GRANT UPDATE ON usuarios TO web_user` sin `REVOKE` por columna | confirmado ✅ |
| `GRANT INSERT ON pedidos TO web_user` | confirmado ✅ |
| `policy usuarios_editarse_a_si_mismo` sin `WITH CHECK` | confirmado ✅ (`init.sql:215-218`) |
| `CREATE INDEX` en los dos schemas | **cero** en ambos ✅ |
| `role="alert"` en `frontend-astro` | 0 ✅ |
| `:focus` en `frontend-astro` | 0 ✅ |
| Los dos `tokens.css` son idénticos | confirmado ✅ |
| Los 4 `.jsx` sin `ErrorBoundary` | confirmado ✅ |
| `404.astro` existe | ❌ no existe ✅ |
| `client:only` / `client:idle` / `client:visible` | ninguno; solo `client:load` ✅ |
| `.map()` en `.astro` sin `key` | correcto (Astro no reconcilia) ✅ |

### Anexo D — Qué NO se hizo en esta revisión

- **No se modificó ningún archivo de código fuente.** El único archivo creado es este informe.
- **No se ejecutó la aplicación.** Todo el análisis es estático, con verificación puntual
  de hipótesis en `/tmp/opencode` (limpiada después).
- **No se corrigió ningún hallazgo.** Los Critical y Alto aparecen como *propuesta* en §9.
- **No se crearon ramas, commits ni tags.**
- **No se auditó `package-lock.json` línea a línea**; se verificó consistencia
  programáticamente (lockfileVersion, correspondencia con `package.json`, entradas sin
  `resolved`, `npm audit`).
- **No se midió rendimiento real.** El N+1 y la amplificación de profundidad se deducen
  del código, no se midieron con carga.
- **No se auditó la accesibilidad con lector de pantalla real**; el anexo B es cálculo
  de contraste WCAG y revisión estática de ARIA.

---

## Conclusión

El repositorio contiene dos implementaciones de la misma tienda, y el patrón de deuda
**no es "el código viejo estaba mal y el nuevo lo arregló"**. Es más preciso: la
reescritura **resolvió el problema grande** (autenticación: de cero a Google OAuth verificado
server-side, cerrando un IDOR trivial) y **heredó todos los problemas pequeños** sin
cambiar una línea (validación de stock, `eliminarProducto` roto, `startStandaloneServer`
sin endurecer, cero índices, dinero en float), **agregando una capa nueva de peor calidad
de permisos** (PostgREST con un secreto versionado, GRANTs a nivel de tabla que exponen
`password`, y un backend GraphQL que conecta como superusuario y por tanto anula la RLS
que se escribió).

Los dos hallazgos que con más razón encabezan este informe son **T-1** y **C-1**. T-1 es
una Barrera que ya fue removida: el commit `e42dd47` vació el `.gitignore` raíz y ahora
`backend/.env` —que contiene `JWT_SECRET` y `GOOGLE_CLIENT_SECRET`— es commiteable en un
repositorio público. C-1 es un secreto de producción versionado con un valor que es
literalmente la cadena *"cambia-esto-por-un-secreto-largo-y-aleatorio"*, presente en dos
archivos. Ninguno de los dos requiere refactor: se arreglan en minutos, y hasta que se
arreglan, todo lo demás que el proyecto haya hecho bien —la verificación server-side del
`id_token`, la arquitectura SSR + islands, la eliminación del `USUARIO_ID_FIJO`
hardcodeado— está construido sobre cimientos que un atacante puede remover con una
petición `curl`.

---

*Informe generado el 29 de septiembre de 2026. Análisis estático sobre 33 archivos fuente
en 4 componentes, con verificación empírica de 34 hipótesis. Ningún archivo de código fue
modificado.*
