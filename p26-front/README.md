# P2-6 — Frontend (momento P2) — NexoPlay

App de React + Vite que implementa el flujo de compra como una **maquina de
estados** (sin URLs): **Home → Detalle de categoria → Detalle de producto**
construidos a fondo, y **Carrito → Checkout** en version simple para que el
resto del equipo los termine.

## 1. Requisitos

- Node.js 18 o superior
- El backend de P2-6 (`p26-back`) corriendo — ver su propio README.

## 2. Instalación

```bash
cd p26-front
npm install
cp .env.example .env
```

`VITE_GRAPHQL_URL` en `.env` ya apunta por defecto a `http://localhost:4001/`,
que es donde corre `p26-back`. Si tu backend usa otro puerto, cambialo ahí.

## 3. Ejecutar

Con el backend ya corriendo en otra terminal:

```bash
npm run dev
```

Abre `http://localhost:5173/`.

## 4. Alcance de esta entrega

Esta practica la hacemos entre dos personas. Lo que se entrega aqui:

| Pantalla | Estado |
|---|---|
| **Home** | Completo: TopBar, Sidebar, Hero, grid de productos, skeletons, buscador |
| **Detalle de categoria** | Completo: consulta la categoria por id, lista productos, maneja carga/error |
| **Detalle de producto** | Completo: info del producto, selector de cantidad limitado por stock, agregar al carrito |
| **Carrito** | Version simple: lista items del `CarritoContext`, permite quitar, calcula total, avanza a Checkout |
| **Checkout** | Version simple: ya conecta con la mutation real `crearPedido` (usuario fijo, ver FAQ de la practica), sin formulario de envio/pago todavia |

Carrito y Checkout quedan **funcionales pero minimos** — hay comentarios en
`src/templates/Carrito.jsx` y `src/templates/Checkout.jsx` marcando
explicitamente que falta pulir ahi (edicion de cantidades por renglon,
formulario de datos de envio, mejores estados de carga).

### Decision documentada — detalle de producto (seccion 5.4)

Se implemento el **detalle de producto como un template mas del flujo**
(un estado mas de la maquina), no como modal con Portal. Se eligio asi
porque el flujo completo ya es lineal y sin URLs; agregar un modal encima
de `DetalleCategoria` hubiera significado mantener dos maquinas de estado
superpuestas (la del flujo + la de "modal abierto/cerrado") sin necesidad
real, ya que ninguna otra pantalla necesita mostrarse "detras" del detalle
de producto.

## 5. Maquina de estados

```
Home → DetalleCategoria → DetalleProducto → Carrito → Checkout → Home
```

Implementada en `src/App.jsx` con `useReducer`. Los eventos son
`elegirCategoria`, `verProducto`, `agregarAlCarrito`, `finalizarCompra`,
`pedidoCreado` y sus correspondientes `volver*`, exactamente como en el
diagrama de la practica.

## 6. Temas del recurso `Vite/` aplicados

| # | Tema | Donde |
|---|---|---|
| 1 | Componentes | `src/components/`, `src/templates/` |
| 2 | Hooks | `useState`/`useReducer`/`useEffect` en todos los templates |
| 3 | Props (padre → hijos) | `ProductoCard`, `Sidebar`, templates reciben datos ya resueltos |
| 4 | Eventos HTML | buscador, selector de cantidad, botones de categoria |
| 5 | Eventos custom | `onVerProducto`, `onElegirCategoria`, `onAgregarAlCarrito` |
| 6 | Drilling → resuelto | `CarritoContext` (ver tema 11) |
| 7 | Fetching | `src/graphql/client.js`, usado en cada template |
| 8 | Keys | listas de categorias, productos e items del carrito |
| 9 | Fragment | `ProductoCard` |
| 10 | Estilos | `src/index.css`, `src/styles/tokens.css`, responsivo |
| 11 | Context (alternativa a Zustand) | `CarritoContext.jsx` |
| 13 | useTransition | `App.jsx`, envuelve los `dispatch` de navegacion |
| 14 | Skeletons | `src/components/Skeleton.jsx` |

12 de 15 temas aplicados (se pide un minimo de 8).

## 7. Estructura

```
p26-front/
├── src/
│   ├── App.jsx                  # maquina de estados
│   ├── main.jsx
│   ├── index.css
│   ├── graphql/client.js         # fetch a GraphQL + queries
│   ├── context/CarritoContext.jsx
│   ├── components/
│   │   ├── ProductoCard.jsx
│   │   ├── Skeleton.jsx
│   │   ├── ErrorMessage.jsx
│   │   └── layout/ (TopBar, Sidebar, Hero, ContextBar, Footer)
│   ├── templates/ (Home, DetalleCategoria, DetalleProducto, Carrito, Checkout)
│   └── styles/tokens.css
├── .env.example
└── package.json
```

## 8. Verificación antes de entregar

```bash
npm run build   # compila sin errores
npm run lint    # 0 errores (oxlint)
```
