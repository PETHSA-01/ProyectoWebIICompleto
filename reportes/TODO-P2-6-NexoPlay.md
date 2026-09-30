# TODO — Práctica P2-6 (NexoPlay)

> Basado en la revisión del código (`p26-back` + `p26-front`) contra
> `1PracticaP2-6.md`. El backend y el flujo Home → Categoría → Producto ya
> están completos; lo pendiente se concentra en Carrito/Checkout, los
> reportes y el empaquetado de entrega.

## Resumen de estado

| Pieza | Estado |
|---|---|
| Schema GraphQL (DER, enums, inputs) | ✅ Completo |
| Resolvers + relaciones anidadas + transacción en `crearPedido` | ✅ Completo |
| SQLite real + seed + `.env` | ✅ Completo |
| Máquina de estados (`useReducer` + `useTransition`) | ✅ Completo |
| Home (TopBar, Sidebar, Hero, ContextBar, grid, skeleton, buscador) | ✅ Completo |
| DetalleCategoria / DetalleProducto (fetch, carga/error, cantidad) | ✅ Completo |
| Carrito compartido vía Context | ✅ Completo |
| Cliente GraphQL genérico | ✅ Completo |
| Checkout conectado a `crearPedido` real | ⚠️ Mínimo |
| Carrito (edición de cantidades, confirmación al quitar) | ⚠️ Mínimo |
| Reportes (`reporte-p2.md`, `reporte-p6.md`, `assets/`) | ❌ Faltan |
| Empaquetado de entrega (2 zips, sin `node_modules`) | ❌ Falta |

---

## 🔴 Tarea 1 — Reportes (bloqueante: "sin reportes no se califica")

No existe ningún `.md` de reporte ni carpeta `assets/` en el zip entregado.

- [ ] **1.1 `reporte-p2.md`**
  - [ ] Portada
  - [ ] Marco teórico: componentes, props, estado, eventos, máquina de
        estados, Context, diseño atómico
  - [ ] Diagrama de componentes (UML) de lo ya construido: `App` →
        `TopBar` / `Footer` / `CarritoProvider` → templates →
        `Sidebar` / `Hero` / `ContextBar` / `ProductoCard` / `ImagenProducto`
  - [ ] Documentar la decisión "detalle de producto como template, no
        modal" (ya está justificada en el README del front — reusar ese
        texto)
  - [ ] Conclusión
- [ ] **1.2 `reporte-p6.md`**
  - [ ] Portada
  - [ ] Marco teórico: GraphQL, schema, query vs mutation, input,
        resolver, relaciones, problema N+1
  - [ ] Diagrama de entidades (DER) + pegar el SDL de `schema.js`
  - [ ] Explicar el N+1 (el comentario técnico ya está en
        `resolvers.js` — convertirlo en explicación/diagrama de reporte)
  - [ ] Conclusión
- [ ] **1.3** Carpeta `assets/` con las imágenes de ambos diagramas

---

## 🟡 Tarea 2 — Completar Carrito

El propio código deja el pendiente marcado: *"edición de cantidades por
renglón, confirmación antes de quitar un producto"* (`Carrito.jsx`).

- [ ] **2.1** Agregar acción `actualizarCantidad(productoId, cantidad)`
      en `CarritoContext.jsx` (junto a `agregarAlCarrito` /
      `quitarDelCarrito` ya existentes)
- [ ] **2.2** En `Carrito.jsx`, reemplazar el texto `x{cantidad}` por un
      selector +/- (reutilizar el patrón `selector-cantidad` que ya
      existe en `DetalleProducto.jsx`)
- [ ] **2.3** Confirmación antes de quitar (`window.confirm` simple o un
      estado `confirmando: productoId` en el propio template)
- [ ] **2.4** Validar que la cantidad no exceda el `stock` del producto
      (agregar `stock` a la query del carrito si hace falta)

---

## 🟡 Tarea 3 — Completar Checkout

Mismo tipo de pendiente marcado en el código: *"formulario de datos de
envío/pago, validaciones, mejor manejo visual de cargando"*
(`Checkout.jsx`).

- [ ] **3.1** Formulario simple (nombre, dirección, método de pago
      simulado) como estado local del template — no requiere backend
      nuevo, es solo UI
- [ ] **3.2** Validaciones básicas antes de habilitar "Confirmar compra"
      (campos vacíos)
- [ ] **3.3** Mejorar el estado `enviando` con spinner/skeleton en vez de
      solo deshabilitar el botón (reusar `Skeleton.jsx`)
- [ ] **3.4** Opcional: usar el `usuarioId` del formulario si se simula
      login; si no, dejar `USUARIO_ID_FIJO` documentado en el reporte
      (válido según la FAQ de la práctica)

---

## 🟢 Tarea 4 — Detalles menores de código

- [ ] **4.1** Agregar `.gitignore` a `p26-back` (el front ya tiene, el
      back no — riesgo de incluir `node_modules` o `nexoplay.db` en el
      zip de entrega)
- [ ] **4.2** Correr `npm run build` y `npm run lint` (oxlint) en el
      front antes de entregar
- [ ] **4.3** *(Opcional, no bloqueante)* Agregar control de "cargar
      más" en Home usando `limite` / `desde`, que el backend ya soporta
      pero el front usa fijo (`limite: 8`)

---

## 🟢 Tarea 5 — Empaquetado de entrega (sección 9 del documento)

- [ ] **5.1** Armar `p26-codigo.zip` con `front/`, `back/`, `db.sql` —
      **sin** `node_modules` (el zip subido sí trae `node_modules`
      completo de `p26-back`, hay que excluirlo)
- [ ] **5.2** Armar `p26-reportes.zip` con `reporte-p2.md`,
      `reporte-p6.md`, `assets/`

---

## Cómo conectan las piezas nuevas con las existentes

- El selector de cantidad del Carrito (2.2) reutiliza el mismo patrón
  visual/CSS que ya usa `DetalleProducto` — se extiende un componente
  existente en vez de crear uno nuevo desde cero.
- `actualizarCantidad` (2.1) se agrega al mismo `CarritoContext` que ya
  consumen `TopBar`, `ContextBar` y `Checkout` — al tocar el Context, los
  tres se actualizan solos, sin tocarlos individualmente.
- El formulario de Checkout (3.1) es puramente local a ese template; no
  necesita cambios en el backend porque `crearPedido` ya solo pide
  `usuarioId` + `detalles`.
- Los reportes (Tarea 1) no tocan código: documentan lo que ya existe
  (schema, resolvers, `App.jsx`), así que se pueden escribir en paralelo
  sin bloquear el resto del trabajo.
