# Reporte P2 — Maquetado del Flujo E-commerce (NexoPlay)

---

## 1. Portada

| Campo | Información |
|-------|-------------|
| **Nombre del alumno** | Betsabe Elizabeth Zamora Esqueda |
| **Materia** | Programación Web 2 (PWII) |
| **Práctica** | P2-6 — Flujo e-commerce (maquetado React) + Backend GraphQL |
| **Fecha** | 11 de septiembre de 2026 |

---

## 2. Marco teórico

### 2.1 Componentes y diseño atómico

El frontend de NexoPlay se estructura siguiendo la metodología de **diseño atómico** (Brad Frost), donde la interfaz se descompone en niveles de complejidad creciente: **átomos** (componentes indivisibles), **moléculas** (grupos de átomos con una responsabilidad clara), **organismos** (secciones completas de la UI) y **templates** (páginas completas que orquestan organismos y definen el layout).

En la práctica, los átomos son `ImagenProducto`, `Skeleton`, `ErrorMessage`, `SelectorCantidad` (inline en `CarritoItem` y `DetalleProducto`), y los botones e inputs básicos. Las moléculas incluyen `ProductoCard` (imagen + nombre + precio + botón), `Sidebar` (lista de categorías con contador), `TopBar` (logo + buscador + contador de carrito), `Hero`, `ContextBar`, `Footer`. Los organismos son las secciones compuestas como el grid de productos en `Home` o el listado del carrito. Finalmente, los **templates** —`Home`, `DetalleCategoria`, `DetalleProducto`, `Carrito`, `Checkout`— son las pantallas completas que la máquina de estados muestra u oculta según el flujo.

Esta separación permite reutilizar átomos y moléculas en distintos templates (p. ej., `ProductoCard` aparece tanto en `Home` como en `DetalleCategoria`), y facilita el mantenimiento: un cambio en `ImagenProducto` se refleja en todo el catálogo sin tocar la lógica de los templates.

### 2.2 Props y flujo de datos padre → hijos

La comunicación descendente se realiza exclusivamente mediante **props**. Cada template recibe del componente raíz (`Flujo` en `App.jsx`) los datos que necesita y las **funciones de callback** (eventos personalizados) para notificar acciones al estado global. Por ejemplo, `Home` recibe `busqueda`, `onElegirCategoria`, `onVerProducto`, `onIrAlCarrito`; `DetalleProducto` recibe `productoId`, `onAgregarAlCarrito`, `onVolver`. Los componentes atómicos y moleculares reciben solo lo estrictamente necesario: `ProductoCard` recibe `producto` y `onVerProducto`; `Sidebar` recibe `categorias`, `cargando`, `onElegirCategoria`.

Este patrón evita que los componentes "hijos" conozcan la arquitectura global (no hay `useNavigate`, no hay `window.location`); su única responsabilidad es renderizar y emitir eventos semánticos (`onVerProducto`, `onAgregarAlCarrito`, `onFinalizarCompra`, `onPedidoCreado`, `onVolver`). El componente padre (`Flujo`) es quien interpreta esos eventos y decide la transición de estado.

### 2.3 Estado y máquina de estados

El flujo de compra **no usa enrutamiento por URLs** (React Router). En su lugar, se implementa una **máquina de estados finita** explícita mediante `useReducer` en `App.jsx`. El estado tiene tres campos:

```javascript
{
  pantalla: 'home' | 'categoria' | 'producto' | 'carrito' | 'checkout',
  categoriaId: number | null,
  productoId: number | null
}
```

Las transiciones son **eventos tipados** (`elegirCategoria`, `verProducto`, `agregarAlCarrito`, `irAlCarrito`, `finalizarCompra`, `pedidoCreado`, `volverHome`, `volverACategoria`, `volverAProducto`, `volverACarrito`). La función reductora `maquina(estado, evento)` es pura: dado el estado actual y el evento, devuelve el nuevo estado sin efectos colaterales. Esto hace el flujo **predecible, testeable y depurable** (se puede loguear cada transición).

El componente `Flujo` expone un objeto `handlers` con funciones que despachan eventos envueltos en `startTransition` (React 18 `useTransition`, tema 13 del recurso Vite), lo que permite que el cambio de template y la carga de datos del backend no bloqueen la interfaz: la UI permanece responsiva mientras se resuelven las consultas GraphQL.

### 2.4 Eventos: HTML y personalizados

Los **eventos HTML** nativos (`onClick`, `onChange`, `onSubmit`, `onBlur`) se usan en los componentes de interacción directa: botones de categoría en `Sidebar`, input de búsqueda en `TopBar`, selectores de cantidad en `DetalleProducto` y `CarritoItem`, formulario en `Checkout`.

Los **eventos personalizados** (callbacks) son el puente entre la UI y la máquina de estados. Se nombran con semántica de dominio (`onElegirCategoria`, `onVerProducto`, `onAgregarAlCarrito`, `onFinalizarCompra`, `onPedidoCreado`, `onVolver` y sus variantes `onVolverHome`, `onVolverACategoria`, `onVolverAProducto`, `onVolverACarrito`). Esto desacopla el componente emisor (que solo sabe "algo pasó") del consumidor (que sabe "qué hacer cuando pasa"). Además, permite probar los templates en aislamiento pasando mocks de los handlers.

### 2.5 Context API: resolución del prop drilling

El carrito de compras es un dato **transversal**: lo lee `TopBar` (contador), `DetalleProducto` (agregar), `Carrito` (listar, editar, quitar), `Checkout` (total, crear pedido). Pasarlo por props a través de `App → Flujo → templates → componentes` habría generado **prop drilling** (tema 6 del recurso Vite).

La solución adoptada es **Context API** (`CarritoContext.jsx`), no Zustand (tema 11, alternativa válida). El proveedor `CarritoProvider` envuelve a `Flujo` en `App.jsx` y expone: `items`, `agregarAlCarrito`, `quitarDelCarrito`, `actualizarCantidad`, `vaciarCarrito`, `totalItems`, `totalPrecio`. Los consumidores usan el hook `useCarrito()` que lanza error si se usa fuera del proveedor, garantizando uso correcto.

`useMemo` memoiza `totalItems` y `totalPrecio` para evitar recálculos en cada render; `useCallback` estabiliza las funciones mutadoras. El estado del carrito vive en memoria (sin `localStorage` por requisito de la práctica), lo cual es suficiente para la sesión de uso.

### 2.6 Fetching asíncrono y GraphQL client genérico

Cada template que necesita datos del backend define su propio ciclo de **carga → éxito → error** con `useState` y `useEffect` (tema 7 del recurso). La función `graphqlRequest(query, variables)` en `client.js` encapsula el `fetch` POST al endpoint único `/graphql`, serializa el cuerpo como JSON, valida `response.ok` y lanza errores legibles si el servidor devuelve `errors` en el payload GraphQL.

Las queries se definen como constantes en `QUERIES` (categorias, categoria, producto, productosDestacados, productosPaginados), lo que evita duplicar strings y facilita mantenimiento. El template `Home` implementa **paginación "cargar más"**: mantiene `desde` y `hayMas`, y al clicar "Cargar más" concatena los nuevos productos al estado existente sin perder los ya renderizados.

### 2.7 Skeletons y manejo de errores

Mientras una consulta está en curso (`cargando === true`), los templates renderizan **Skeletons** (tema 14): `SkeletonGrid` para listas de tarjetas, `SkeletonDetalle` para la ficha de producto. Estos placeholders animados (CSS `@keyframes pulse`) comunican "algo está llegando" mejor que un spinner genérico y preservan el layout final (evitan *layout shift*).

Si la consulta falla, se muestra `ErrorMessage` con el mensaje del error y un botón **Reintentar** que vuelve a disparar la carga. Este patrón se repite en `Home` (categorías y productos), `DetalleCategoria`, `DetalleProducto`, `Checkout`.

### 2.8 Decisión: Detalle de producto como template del flujo (no modal/Portal)

La práctica (sección 5.4) permite dos opciones: (a) un template más en la máquina de estados, o (b) un modal usando **Portales** (tema 15 del recurso Vite). Se eligió la **opción (a)** por las siguientes razones:

1. **Consistencia de navegación**: el usuario avanza y retrocede con los mismos botones "Volver" en todas las pantallas; no hay una interacción distinta (overlay + backdrop + ESC para cerrar) solo para el detalle.
2. **Simplicidad de estado**: el `productoId` vive en el estado de la máquina igual que `categoriaId`; no hay que gestionar "modal abierto/cerrado" como estado paralelo.
3. **Accesibilidad nativa**: el foco se maneja de forma natural al cambiar de template; un modal requiere `focus-trap`, `aria-modal`, restauración de foco al cerrar.
4. **SEO y compartibilidad futura**: si en adelante se añade enrutamiento real, cada template ya tiene su estado identificable; un modal es efímero y no direccionable.

La contrapartida es que el usuario no ve el catálogo de fondo mientras está en el detalle. Para este e-commerce de demostración, la claridad del flujo pesó más que la vista contextual.

### 2.9 Temas del recurso Vite aplicados (11/15)

| # | Tema | Aplicado | Evidencia |
|---|------|----------|-----------|
| 1 | Componentes | ✅ | Átomos, moléculas, organismos, templates |
| 2 | Hooks | ✅ | `useState`, `useEffect`, `useReducer`, `useTransition`, `useMemo`, `useCallback` |
| 3 | Props padre→hijos | ✅ | Todos los templates y componentes reciben datos y callbacks por props |
| 4 | Eventos HTML | ✅ | `onClick`, `onChange`, `onSubmit`, `onBlur` en formularios y botones |
| 5 | Eventos custom | ✅ | `onElegirCategoria`, `onVerProducto`, `onAgregarAlCarrito`, `onFinalizarCompra`, `onPedidoCreado`, `onVolver*` |
| 6 | Drilling resuelto con Context | ✅ | `CarritoContext` evita pasar carrito por 4 niveles |
| 7 | Fetching | ✅ | `graphqlRequest` asíncrono en cada template |
| 8 | Keys en listas | ✅ | `key={producto.id}`, `key={categoria.id}`, `key={item.producto.id}` |
| 9 | Fragment | ✅ | Uso de `<>...</>` en `Home`, `DetalleProducto`, `Carrito` |
| 10 | Estilos | ✅ | CSS con tokens (`tokens.css`), responsivo, BEM-like |
| 11 | Zustand | ❌ | Se usó Context API como alternativa válida |
| 12 | LINT | ✅ | `oxlint` pasa sin errores |
| 13 | useTransition | ✅ | En `App.jsx` para transiciones no bloqueantes |
| 14 | Skeletons | ✅ | `SkeletonGrid`, `SkeletonDetalle`, `skeleton-bloque` en Sidebar |
| 15 | Portales | ❌ | Detalle es template, no modal |

---

## 3. Diseño UML — Diagrama de componentes

El siguiente diagrama Mermaid muestra la arquitectura de componentes del frontend, sus relaciones de composición y el flujo de datos (props hacia abajo, eventos hacia arriba, Context transversal).

```mermaid
graph TD
    %% Niveles de diseño atómico
    subgraph Atomos["Átomos"]
        ImagenProducto[ImagenProducto]
        Skeleton[Skeleton<br/>(SkeletonGrid, SkeletonDetalle)]
        ErrorMessage[ErrorMessage]
        SelectorCantidad[SelectorCantidad<br/>(inline)]
        Boton[Botón / Input / Label]
    end

    subgraph Moleculas["Moléculas"]
        ProductoCard[ProductoCard]
        Sidebar[Sidebar]
        TopBar[TopBar]
        Hero[Hero]
        ContextBar[ContextBar]
        Footer[Footer]
        CarritoItem[CarritoItem]
    end

    subgraph Organismos["Organismos"]
        GridProductos[Grid de Productos]
        ListaCarrito[Lista del Carrito]
        FormularioCheckout[Formulario Checkout]
    end

    subgraph Templates["Templates (Pantallas del flujo)"]
        Home[Home]
        DetalleCategoria[DetalleCategoria]
        DetalleProducto[DetalleProducto]
        Carrito[Carrito]
        Checkout[Checkout]
    end

    subgraph EstadoGlobal["Estado global / Maquina de estados"]
        Flujo[Flujo (useReducer + useTransition)]
        CarritoCtx[CarritoContext<br/>(Provider + useCarrito)]
    end

    subgraph Datos["Capa de datos"]
        GraphQLClient[graphqlRequest + QUERIES]
    end

    %% Composición: templates contienen organismos/moleculas/atomos
    Home --> GridProductos
    Home --> Sidebar
    Home --> Hero
    Home --> ContextBar
    Home --> TopBar
    Home --> Footer

    DetalleCategoria --> GridProductos
    DetalleCategoria --> TopBar
    DetalleCategoria --> Footer

    DetalleProducto --> ImagenProducto
    DetalleProducto --> SelectorCantidad
    DetalleProducto --> TopBar
    DetalleProducto --> Footer

    Carrito --> ListaCarrito
    Carrito --> TopBar
    Carrito --> Footer

    Checkout --> FormularioCheckout
    Checkout --> TopBar
    Checkout --> Footer

    %% Organismos compuestos de moléculas/átomos
    GridProductos --> ProductoCard
    ProductoCard --> ImagenProducto
    ProductoCard --> Boton

    ListaCarrito --> CarritoItem
    CarritoItem --> SelectorCantidad
    CarritoItem --> Boton

    FormularioCheckout --> Boton
    FormularioCheckout --> SelectorCantidad

    Sidebar --> Boton
    TopBar --> Boton
    TopBar --> SelectorCantidad
    ContextBar --> Boton

    %% Flujo de datos: props down, events up
    Flujo -.->|estado.pantalla<br/>categoriaId, productoId| Home
    Flujo -.->|estado.pantalla<br/>categoriaId| DetalleCategoria
    Flujo -.->|estado.pantalla<br/>productoId| DetalleProducto
    Flujo -.->|estado.pantalla| Carrito
    Flujo -.->|estado.pantalla| Checkout

    Flujo -.->|handlers (callbacks)| Home
    Flujo -.->|handlers| DetalleCategoria
    Flujo -.->|handlers| DetalleProducto
    Flujo -.->|handlers| Carrito
    Flujo -.->|handlers| Checkout

    %% Context transversal
    CarritoCtx -.->|totalItems| TopBar
    CarritoCtx -.->|items, agregar, quitar,<br/>actualizar, totalPrecio| DetalleProducto
    CarritoCtx -.->|items, quitar, actualizar,<br/>totalPrecio| Carrito
    CarritoCtx -.->|items, totalPrecio, vaciar| Checkout

    %% Fetching
    Home --> GraphQLClient
    DetalleCategoria --> GraphQLClient
    DetalleProducto --> GraphQLClient
    Checkout --> GraphQLClient

    %% Estilos
    classDef atom fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px;
    classDef mol fill:#e3f2fd,stroke:#1565c0,stroke-width:1px;
    classDef org fill:#fff3e0,stroke:#ef6c00,stroke-width:1px;
    classDef tmpl fill:#fce4ec,stroke:#c2185b,stroke-width:2px;
    classDef state fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    classDef data fill:#e0f2f1,stroke:#00695c,stroke-width:1px;

    class ImagenProducto,Skeleton,ErrorMessage,SelectorCantidad,Boton atom;
    class ProductoCard,Sidebar,TopBar,Hero,ContextBar,Footer,CarritoItem mol;
    class GridProductos,ListaCarrito,FormularioCheckout org;
    class Home,DetalleCategoria,DetalleProducto,Carrito,Checkout tmpl;
    class Flujo,CarritoCtx state;
    class GraphQLClient data;
```

### Explicación del diagrama

- **Flechas continuas** (`-->`): composición (un componente *contiene* o *renderiza* a otro).
- **Flechas punteadas** (`-.->`): flujo de datos / dependencia lógica (props, callbacks, Context, llamadas a `graphqlRequest`).
- **Colores**: verde = átomos, azul = moléculas, naranja = organismos, rosa = templates, púrpura = estado global/máquina, teal = capa de datos.
- **CarritoContext** es transversal: no pertenece a un template específico, lo consumen `TopBar`, `DetalleProducto`, `Carrito`, `Checkout` sin intermediarios.
- **Flujo** (el `useReducer` + `useTransition`) es el cerebro: decide qué template se renderiza y provee los `handlers` que conectan eventos de UI con transiciones de estado.

---

## 4. Conclusión

### ¿Qué aprendí?

Esta práctica consolidó mi comprensión de **React como máquina de estados declarativa**. Antes veía el estado como "variables que cambian"; ahora entiendo que modelar el flujo como **estado + eventos + transiciones puras** elimina una clase entera de bugs (estados imposibles, transiciones inválidas, bucles de render). El patrón `useReducer` + `handlers` + `useTransition` es una arquitectura ligera pero potente para flujos lineales como un checkout.

Aprendí a **diseñar componentes por responsabilidad única**: `ProductoCard` solo renderiza una tarjeta y avisa "quieren ver este producto"; no sabe nada de routing, de carrito, ni de GraphQL. Esa separación hace que el código sea legible y testeable.

El **Context API** resolvió el prop drilling del carrito de forma nativa, sin dependencias externas. Entendí cuándo *sí* merece la pena un store global (datos transversales, alta frecuencia de lectura/escritura) y cuándo basta con props (datos locales a una rama del árbol).

En el plano de **GraphQL**, integrar el frontend con un backend propio (no mock) obligó a definir queries exactas, tipar variables, manejar errores de red y de negocio, y mostrar feedback visual (skeletons, reintentar). La paginación "cargar más" con `desde`/`limite` y la concatenación de resultados en estado fue un ejercicio real de UX de datos.

### Dificultades y cómo las resolví

1. **N+1 en el backend** (documentado en `resolvers.js`): al listar categorías con sus productos, cada categoría disparaba una consulta separada. En el frontend no se nota porque el catálogo es pequeño (3 categorías), pero en el reporte P6 documento la solución teórica (DataLoader / batching / JOIN). En el frontend, la mitigación práctica fue pedir solo lo necesario: `Home` pide `productosPaginados` (plano), no `categorias { productos }`.

2. **Transiciones bloqueantes al cambiar de template**: al principio, `dispatch` directo congelaba la UI mientras `DetalleProducto` hacía su `useEffect` + `fetch`. Envolver el `dispatch` en `startTransition` (React 18) permitió que la UI antigua siguiera interactiva (scroll, buscador) mientras la nueva pantalla cargaba su skeleton. Fue un hallazgo valioso del tema 13 del recurso Vite.

3. **Validación de stock en selector de cantidad**: tanto en `DetalleProducto` como en `CarritoItem` el selector debe respetar `1 ≤ cantidad ≤ stock`. La lógica se duplicaba. La resolví centralizando el `clamp` en `CarritoContext.actualizarCantidad` (para el carrito) y replicando la misma fórmula en `DetalleProducto.cambiarCantidad` (antes de agregar). En una versión futura, extraería una utilidad `clampCantidad(cantidad, stock)`.

4. **Confirmación antes de quitar en carrito**: el requisito pedía "confirmar antes de quitar". Implementé un estado local `confirmando` en `CarritoItem` que alterna entre botón "Quitar" y par "Sí/No". Es simple, accesible (foco gestionado por React) y no requiere librerías de modales.

### Aplicación al Proyecto Final (PF) de e-commerce

- **Máquina de estados extendida**: el PF tendrá más pasos (login, dirección, pago, confirmación, historial). La misma arquitectura `useReducer` + `handlers` escala añadiendo estados y eventos; la pureza de la reductora garantiza que no se rompan flujos previos.
- **Context para sesión de usuario**: igual que el carrito, el usuario autenticado (token, perfil, rol) será un Context transversal. `TopBar` mostrará avatar/menú; `Checkout` usará `usuarioId` real en lugar del fijo `2`.
- **Persistencia del carrito**: `localStorage` + hidratación al montar `CarritoProvider` para sobrevivir a recargas.
- **Optimistic UI en carrito**: al agregar/quitar/actualizar, actualizar el Context *antes* de confirmar con backend (si el PF tiene endpoint de carrito persistido), con rollback automático si falla.
- **DataLoader en backend**: resolver el N+1 real con `@graphql-tools/batch-delegate` o `dataloader` para que `categorias { productos }` sea una sola consulta SQL con `IN (...)` + agrupado en memoria.
- **Testing**: la reductora pura y los handlers aislados permiten tests unitarios de flujo sin renderizar (Jest + `@testing-library/react` para componentes).
- **Accesibilidad**: los patrones actuales (labels, `aria-label`, `aria-invalid`, `aria-describedby`, focus visible, skeletons con `aria-busy`) son la base; el PF añadirá `focus-trap` en modales, anuncios de carga con `aria-live`, y navegación por teclado completa.

---

*Fin del reporte P2*