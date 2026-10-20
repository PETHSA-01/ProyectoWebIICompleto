# Descripción del proyecto: Sistema E-commerce para la Venta de Accesorios de Consolas y Equipos Especializados en Videojuegos

**Institución:** Centro de Enseñanza Técnica Industrial (CETI)
**Carrera / UAC:** Desarrollo de Software, Proyecto Integrador de Desarrollo de Software I
**Producto de aprendizaje:** Propuesta de proyecto
**Integrantes:** Betsabe Elizabeth Zamora (registro 22300935) y Saul Alexander Perez Gonzalez (registro 23100128), grupo 8A1

## 1. Resumen

El proyecto propone una plataforma de comercio electrónico full-stack, desplegada en la nube en un entorno cercano a producción. Está especializada en accesorios de consolas y equipos gaming, con enfoque principal en el ecosistema Xbox. Integra catálogo de productos, carrito, checkout con pasarelas de pago reales (Mercado Pago y PayPal) y un panel administrativo con roles diferenciados. También incluye un pipeline de integración y despliegue continuo (CI/CD) que automatiza pruebas, validación de calidad y despliegue.

## 2. Problema que atiende

Los accesorios y productos para Xbox (controles, headsets, cargadores, cables, fundas, membresías) se venden sobre todo en marketplaces genéricos como Amazon, Mercado Libre o eBay. Eso genera varios problemas:

- El catálogo Xbox se mezcla con miles de productos de otras marcas y categorías, lo que dificulta la navegación especializada.
- No hay un canal de atención inmediata (chat) enfocado en dudas del ecosistema Xbox, como compatibilidad, envíos, pagos y garantías.
- El seguimiento de una orden (pendiente, confirmada, enviada, entregada) no siempre es claro para el comprador.
- Un pequeño comercio no tiene una solución ligera, propia y de bajo costo para vender sin comisiones ni depender de la identidad de un marketplace.
- La gestión de inventario, stock, órdenes y reportes en plataformas de terceros es limitada y no permite roles internos propios.

## 3. A quién va dirigido

- **Consumidores y gamers** que buscan un lugar centralizado, confiable y rápido para comprar accesorios con seguimiento claro de su compra.
- **Compradores primerizos** que necesitan orientación mediante un chat de soporte.
- **Pequeños comerciantes y emprendedores** que necesitan una tienda propia con panel administrativo y sin comisiones de marketplace.
- **El equipo interno de la tienda** (administradores y operadores), que gestiona productos, stock y órdenes con roles diferenciados.

## 4. Contexto de aplicación

- **Usuarios:** clientes, operadores (stock y órdenes) y administradores (control total).
- **Condiciones:** navegadores modernos (Chrome, Firefox, Edge) en escritorio y móvil, con diseño responsive.
- **Entorno:** comercio en línea con posibilidad de escalar a dominio propio y despliegue en la nube.

## 5. Propuesta y objetivo general

**Propuesta:** desarrollar una plataforma de comercio electrónico full-stack, desplegada en la nube, con catálogo, carrito, checkout con pasarelas reales, panel administrativo y CI/CD.

**Objetivo general:** diseñar, desarrollar y desplegar un sistema de e-commerce seguro y escalable. Los usuarios compran con pasarelas de pago reales y el equipo administrativo controla productos, usuarios y pedidos. Se aplican buenas prácticas de arquitectura, seguridad y documentación, además de integración de servicios de terceros y automatización de construcción y despliegue.

## 6. Módulos y funcionalidades

### Barra de navegación (en todas las páginas)
- Logo "XBOX STORE": siempre lleva al catálogo, que es la página de inicio.
- Enlaces "Tienda", "Mis Órdenes" y "Perfil". Los dos últimos solo aparecen con sesión iniciada.
- "Panel Admin": visible solo para los roles administrador y operador.
- Botones "Iniciar Sesión" y "Registrarse" cuando no hay sesión.
- Botón "Carrito" con contador, solo con sesión activa.
- Nombre de usuario con insignia de rol y botón "Salir", que cierra sesión y limpia el token.

### Inicio y catálogo
- **Portada (hero):** título "ACCESORIOS XBOX", subtítulo con la propuesta de valor, botón "Ver Catálogo" que baja a la cuadrícula y botón "Crear Cuenta Gratis" para visitantes sin sesión. Muestra estadísticas rápidas: número de productos, "100% Original" y "Soporte".
- **Filtros:** búsqueda por texto en tiempo real, ordenamiento por precio ascendente o descendente y por nombre de la A a la Z, y chips de categoría dinámicos.
- **Cuadrícula de productos:** tarjetas con imagen, nombre, precio y categoría, con estado de carga tipo skeleton.

### Detalle de producto
Imagen y ficha técnica (nombre, descripción, precio, stock), selector de cantidad, botón "Añadir al carrito" y sección de productos relacionados de la misma categoría.

### Carrito
Listado con imagen, nombre y precio unitario, controles de cantidad (+/-), botón para eliminar artículos y resumen automático de subtotal, IVA y total. Desde aquí se pasa al checkout.

### Checkout en dos pasos
1. **Perfil de envío:** se elige uno existente o se crea uno nuevo con nombre, correo, teléfono, dirección, ciudad y país.
2. **Confirmación:** resumen final de productos y totales, con indicador visual de pasos. El botón "Confirmar orden" genera la orden en estado "pendiente" y vacía el carrito.

### Mis órdenes
Filtro por estado (pendiente, confirmada, enviada, entregada, cancelada) y tarjetas con línea de tiempo del pedido. El cliente puede cancelar mientras la orden esté pendiente o confirmada. El detalle de cada orden muestra productos, cantidades, precios, perfil de envío y estado. Si no hay órdenes, un botón invita a ver el catálogo.

### Perfil de usuario
Datos de la cuenta (usuario, correo, rol), estadísticas de compra (órdenes realizadas, total gastado) y perfiles de envío guardados para reutilizarlos.

### Lista de deseos
Botón de favorito (❤) en cada producto y una página que agrupa los favoritos para revisarlos o pasarlos al carrito. Se guarda en `localStorage`.

### Login y registro
- **Login:** correo y contraseña, con redirección según el rol (admin y operador al panel, cliente al catálogo). Incluye botones de cuentas de demostración (Admin, Operador, Cliente) que autocompletan el formulario, útiles para la evaluación.
- **Registro:** usuario, correo, contraseña y confirmación, con validación de coincidencia y longitud mínima. Toda cuenta nueva se crea con rol "Cliente".

### Panel administrativo (solo Admin y Operador)

| Sección | Función |
|---|---|
| Dashboard | KPIs de ventas, órdenes recientes y productos con bajo stock |
| Productos | Crear, editar y desactivar productos, actualizar stock y subir imágenes con arrastrar y soltar |
| Órdenes | Todas las órdenes, con filtro por estado y acciones para confirmar, enviar, entregar o cancelar |
| Compradores | Perfiles de envío registrados por los clientes |
| Reportes | Ingresos totales, ticket promedio y ventas por estado y por categoría |
| Usuarios | Listado y desactivación de cuentas (solo Admin) |
| "Ir a la Tienda" | Regreso a la vista pública |

## 7. Aplicaciones similares

| Sitio | Similitud | Diferencia frente a la propuesta |
|---|---|---|
| Microsoft Store / Xbox oficial | Mismo nicho, con catálogo, carrito y checkout | Es la tienda oficial de la marca, con inventario global y garantías oficiales, y sin chat de soporte tipo FAQ |
| Amazon (Gaming) | Filtros, carrito, seguimiento y atención al cliente | No está especializado, y el vendedor depende de Seller Central |
| GameStop en línea | Enfoque gaming y cuenta con historial de pedidos | Vende también juegos físicos y usados, con tiendas físicas |
| Mercado Libre (tiendas oficiales) | Carrito, checkout y mensajería comprador-vendedor | Depende de comisiones y reglas del marketplace, sin panel propio |
| Best Buy (videojuegos) | Catálogo filtrable, checkout y chat | Es retail multicategoría, no una solución propia para un nicho |

## 8. Argumentos de viabilidad, aplicabilidad, accesibilidad y usabilidad

- **Viabilidad:** el stack es amplio, pero todas sus tecnologías son gratuitas y bien documentadas. Un equipo de 2 o 3 personas puede dividir el trabajo por capas (frontend, backend, bases de datos, CI/CD) y entregar un MVP en el tiempo del curso.
- **Aplicabilidad:** resuelve una necesidad real de mercado y cumple los requerimientos académicos: pagos reales, arquitectura hexagonal de datos, API GraphQL y automatización CI/CD.
- **Accesibilidad:** Astro con renderizado híbrido (SSR o estático con islas interactivas) y React permiten cargas rápidas y acceso desde cualquier navegador y dispositivo.
- **Usabilidad:** el flujo es simple y predecible (catálogo, carrito, checkout con pago real, seguimiento de orden), reforzado con correos automáticos de estado mediante un servicio de terceros.

## 9. Tecnologías

| Capa | Tecnología | Uso |
|---|---|---|
| Frontend | Astro | Sitio principal con páginas rápidas y mejor SEO (catálogo, landing, detalle) |
| Frontend | React | Islas interactivas: carrito, checkout, panel admin, chat |
| Backend | Node.js | Entorno de ejecución del servidor |
| Backend | GraphQL | Endpoint único y flexible para productos, órdenes y usuarios |
| Base relacional | PostgreSQL | Datos transaccionales: usuarios, productos, órdenes, pagos |
| Base no relacional | MongoDB | Chat, notificaciones, reseñas y logs |
| Pagos | Mercado Pago y PayPal | Pasarelas para Latinoamérica e internacional |
| Terceros | Envío de correos, almacenamiento y optimización de imágenes, login social, API de mapas (opcional) | Notificaciones, imágenes, autenticación externa y direcciones |
| Seguridad | JWT, bcrypt, variables de entorno | Rutas protegidas, cifrado de contraseñas y secretos fuera del código |
| CI/CD | GitHub Actions o equivalente | Build, pruebas, análisis de calidad y despliegue automático |
| Hosting | Vercel o Netlify (frontend), Render, Railway o Fly.io (backend), Railway o Supabase (PostgreSQL), MongoDB Atlas | Despliegue en la nube con bases gestionadas |

## Observaciones sobre el documento

Al revisar el texto encontré cuatro puntos que conviene corregir antes de entregarlo:

- La sección 4 no menciona Astro, pero las secciones 9 y 10 sí.
- En la sección 4, "mondongodeb" debería ser "MongoDB".
- El chat de soporte aparece como problema y como tecnología, pero no tiene un módulo propio en la sección 7.
- Falta completar la sección 1, "Cambios en esta versión", y la fecha del encabezado.
