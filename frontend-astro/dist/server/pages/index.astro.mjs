import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead, g as addAttribute } from '../chunks/astro/server_Cpc1lNFO.mjs';
import 'piccolore';
import { g as graphqlRequest, b as $$BaseLayout } from '../chunks/graphql_BVDHsvyt.mjs';
/* empty css                                 */
import { Q as QUERIES } from '../chunks/queries_CNBrlWqk.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  let categorias = [];
  let productosDestacados = [];
  let errorCarga = null;
  try {
    const [dataCategorias, dataProductos] = await Promise.all([
      graphqlRequest(QUERIES.categorias),
      graphqlRequest(QUERIES.productosDestacados, { limite: 8 })
    ]);
    categorias = dataCategorias.categorias;
    productosDestacados = dataProductos.productos;
  } catch (err) {
    errorCarga = err.message;
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Inicio", "data-astro-cid-j7pv25f6": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="hero" data-astro-cid-j7pv25f6> <div class="contenedor" data-astro-cid-j7pv25f6> <h1 data-astro-cid-j7pv25f6>Todo para tu setup Xbox, en un solo lugar</h1> <p data-astro-cid-j7pv25f6>Consolas, controles, audifonos y videojuegos con envio a todo México.</p> </div> </section> ${errorCarga && renderTemplate`<div class="contenedor" data-astro-cid-j7pv25f6> <p class="error" data-astro-cid-j7pv25f6>No se pudo cargar el catalogo: ${errorCarga}</p> </div>`}<section class="contenedor" data-astro-cid-j7pv25f6> <h2 data-astro-cid-j7pv25f6>Categorías</h2> <div class="grid-categorias" data-astro-cid-j7pv25f6> ${categorias.map((cat) => renderTemplate`<a${addAttribute(`/categoria/${cat.id}`, "href")} class="tarjeta-categoria" data-astro-cid-j7pv25f6> <span data-astro-cid-j7pv25f6>${cat.nombre}</span> <small data-astro-cid-j7pv25f6>${cat.productos.length} productos</small> </a>`)} </div> </section> <section class="contenedor" data-astro-cid-j7pv25f6> <h2 data-astro-cid-j7pv25f6>Destacados</h2> <div class="grid-productos" data-astro-cid-j7pv25f6> ${productosDestacados.map((p) => renderTemplate`<a${addAttribute(`/producto/${p.id}`, "href")} class="tarjeta-producto" data-astro-cid-j7pv25f6> <img${addAttribute(p.imagen, "src")}${addAttribute(p.nombre, "alt")} loading="lazy" data-astro-cid-j7pv25f6> <div class="tarjeta-producto__info" data-astro-cid-j7pv25f6> <span class="tarjeta-producto__nombre" data-astro-cid-j7pv25f6>${p.nombre}</span> <span class="tarjeta-producto__categoria" data-astro-cid-j7pv25f6>${p.categoria.nombre}</span> <strong data-astro-cid-j7pv25f6>$${Number(p.precio).toFixed(2)} MXN</strong> </div> </a>`)} </div> </section>  ` })}`;
}, "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/index.astro", void 0);

const $$file = "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
