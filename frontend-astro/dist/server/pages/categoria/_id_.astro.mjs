import { e as createComponent, k as renderComponent, r as renderTemplate, h as createAstro, m as maybeRenderHead, l as Fragment, g as addAttribute } from '../../chunks/astro/server_Cpc1lNFO.mjs';
import 'piccolore';
import { g as graphqlRequest, b as $$BaseLayout } from '../../chunks/graphql_BVDHsvyt.mjs';
/* empty css                                   */
import { Q as QUERIES } from '../../chunks/queries_CNBrlWqk.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  let categoria = null;
  let errorCarga = null;
  try {
    const data = await graphqlRequest(QUERIES.categoria, { id });
    categoria = data.categoria;
  } catch (err) {
    errorCarga = err.message;
  }
  if (!categoria && !errorCarga) {
    return Astro2.redirect("/404");
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": categoria ? categoria.nombre : "Categor\xEDa", "data-astro-cid-hd6cl5vo": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="contenedor" data-astro-cid-hd6cl5vo> <a href="/" class="volver" data-astro-cid-hd6cl5vo>← Volver al inicio</a> ${errorCarga && renderTemplate`<p class="error" data-astro-cid-hd6cl5vo>No se pudo cargar la categoría: ${errorCarga}</p>`} ${categoria && renderTemplate`${renderComponent($$result2, "Fragment", Fragment, { "data-astro-cid-hd6cl5vo": true }, { "default": async ($$result3) => renderTemplate` <h1 data-astro-cid-hd6cl5vo>${categoria.nombre}</h1> <div class="grid-productos" data-astro-cid-hd6cl5vo> ${categoria.productos.map((p) => renderTemplate`<a${addAttribute(`/producto/${p.id}`, "href")} class="tarjeta-producto" data-astro-cid-hd6cl5vo> <img${addAttribute(p.imagen, "src")}${addAttribute(p.nombre, "alt")} loading="lazy" data-astro-cid-hd6cl5vo> <div class="tarjeta-producto__info" data-astro-cid-hd6cl5vo> <span class="tarjeta-producto__nombre" data-astro-cid-hd6cl5vo>${p.nombre}</span> <strong data-astro-cid-hd6cl5vo>$${Number(p.precio).toFixed(2)} MXN</strong> <small data-astro-cid-hd6cl5vo>${p.stock > 0 ? `${p.stock} en stock` : "Sin stock"}</small> </div> </a>`)} </div> ` })}`} </section>  ` })}`;
}, "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/categoria/[id].astro", void 0);

const $$file = "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/categoria/[id].astro";
const $$url = "/categoria/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
