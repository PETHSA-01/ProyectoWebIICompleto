import { e as createComponent, k as renderComponent, r as renderTemplate, h as createAstro, m as maybeRenderHead, g as addAttribute } from '../../chunks/astro/server_Cpc1lNFO.mjs';
import 'piccolore';
import { c as agregarAlCarrito, g as graphqlRequest, b as $$BaseLayout } from '../../chunks/graphql_BVDHsvyt.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState } from 'react';
/* empty css                                   */
import { Q as QUERIES } from '../../chunks/queries_CNBrlWqk.mjs';
export { renderers } from '../../renderers.mjs';

function AgregarAlCarrito({ producto }) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);
  const handleAgregar = () => {
    agregarAlCarrito(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };
  return /* @__PURE__ */ jsxs("div", { className: "agregar-carrito", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        type: "number",
        min: "1",
        max: producto.stock,
        value: cantidad,
        onChange: (e) => setCantidad(Math.max(1, Number(e.target.value))),
        className: "agregar-carrito__cantidad",
        "aria-label": "Cantidad"
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "boton boton--primario",
        onClick: handleAgregar,
        disabled: producto.stock === 0,
        children: producto.stock === 0 ? "Sin stock" : agregado ? "¡Agregado!" : "Agregar al carrito"
      }
    ),
    /* @__PURE__ */ jsx("style", { children: `
        .agregar-carrito { display: flex; gap: 10px; align-items: center; margin-top: 16px; }
        .agregar-carrito__cantidad { width: 64px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
      ` })
  ] });
}

const $$Astro = createAstro();
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$id;
  const { id } = Astro2.params;
  let producto = null;
  let errorCarga = null;
  try {
    const data = await graphqlRequest(QUERIES.producto, { id });
    producto = data.producto;
  } catch (err) {
    errorCarga = err.message;
  }
  if (!producto && !errorCarga) {
    return Astro2.redirect("/404");
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": producto ? producto.nombre : "Producto", "data-astro-cid-mvbiubgv": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="contenedor detalle" data-astro-cid-mvbiubgv> ${producto && renderTemplate`<a${addAttribute(`/categoria/${producto.categoria.id}`, "href")} class="volver" data-astro-cid-mvbiubgv>
← ${producto.categoria.nombre} </a>`} ${errorCarga && renderTemplate`<p class="error" data-astro-cid-mvbiubgv>No se pudo cargar el producto: ${errorCarga}</p>`} ${producto && renderTemplate`<div class="detalle__grid" data-astro-cid-mvbiubgv> <img${addAttribute(producto.imagen, "src")}${addAttribute(producto.nombre, "alt")} class="detalle__imagen" data-astro-cid-mvbiubgv> <div class="detalle__info" data-astro-cid-mvbiubgv> <h1 data-astro-cid-mvbiubgv>${producto.nombre}</h1> <p class="detalle__precio" data-astro-cid-mvbiubgv>$${Number(producto.precio).toFixed(2)} MXN</p> <p class="detalle__stock" data-astro-cid-mvbiubgv> ${producto.stock > 0 ? `${producto.stock} disponibles` : "Sin stock por el momento"} </p> <!-- Unica parte interactiva de esta pagina: el resto es HTML
               renderizado en el servidor. producto se pasa como prop
               serializable (id, nombre, precio, stock) para la isla. --> ${renderComponent($$result2, "AgregarAlCarrito", AgregarAlCarrito, { "client:load": true, "producto": {
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio,
    stock: producto.stock
  }, "client:component-hydration": "load", "client:component-path": "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/components/AgregarAlCarrito.jsx", "client:component-export": "default", "data-astro-cid-mvbiubgv": true })} </div> </div>`} </section>  ` })}`;
}, "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/producto/[id].astro", void 0);

const $$file = "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/producto/[id].astro";
const $$url = "/producto/[id]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$id,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
