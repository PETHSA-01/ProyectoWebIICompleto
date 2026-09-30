import { e as createComponent, k as renderComponent, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Cpc1lNFO.mjs';
import 'piccolore';
import { $ as $carrito, a as $sesion, q as quitarDelCarrito, g as graphqlRequest, v as vaciarCarrito, b as $$BaseLayout } from '../chunks/graphql_BVDHsvyt.mjs';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { M as MUTATIONS } from '../chunks/queries_CNBrlWqk.mjs';
/* empty css                                   */
export { renderers } from '../renderers.mjs';

function CarritoCheckout() {
  const carrito = useStore($carrito);
  const sesion = useStore($sesion);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const total = carrito.reduce((acc, r) => acc + r.precio * r.cantidad, 0);
  const confirmarPedido = async () => {
    setProcesando(true);
    setError(null);
    try {
      const data = await graphqlRequest(
        MUTATIONS.crearPedido,
        { d: { detalles: carrito.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad })) } },
        sesion.token
      );
      setResultado(data.crearPedido);
      vaciarCarrito();
    } catch (err) {
      setError(
        err.status === 401 ? "Tu sesion expiro. Sal y vuelve a entrar con Google para confirmar el pedido." : err.message
      );
    } finally {
      setProcesando(false);
    }
  };
  if (resultado) {
    return /* @__PURE__ */ jsxs("div", { className: "checkout-ok", children: [
      /* @__PURE__ */ jsx("h2", { children: "¡Pedido confirmado!" }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Pedido #",
        resultado.id,
        " — Total: $",
        Number(resultado.total).toFixed(2),
        " MXN"
      ] }),
      /* @__PURE__ */ jsx("ul", { children: resultado.detalles.map((d, i) => /* @__PURE__ */ jsxs("li", { children: [
        d.cantidad,
        "x ",
        d.producto.nombre,
        " — $",
        Number(d.subtotal).toFixed(2)
      ] }, i)) }),
      /* @__PURE__ */ jsx("a", { href: "/", className: "boton boton--primario", children: "Seguir comprando" })
    ] });
  }
  if (carrito.length === 0) {
    return /* @__PURE__ */ jsxs("div", { className: "carrito-vacio", children: [
      /* @__PURE__ */ jsx("p", { children: "Tu carrito esta vacio." }),
      /* @__PURE__ */ jsx("a", { href: "/", className: "boton boton--secundario", children: "Ver catalogo" })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "carrito", children: [
    /* @__PURE__ */ jsx("ul", { className: "carrito__lista", children: carrito.map((r) => /* @__PURE__ */ jsxs("li", { className: "carrito__renglon", children: [
      /* @__PURE__ */ jsxs("span", { className: "carrito__nombre", children: [
        r.nombre,
        " ",
        /* @__PURE__ */ jsxs("small", { children: [
          "x",
          r.cantidad
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { children: [
        "$",
        (r.precio * r.cantidad).toFixed(2)
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "boton boton--texto boton--peligro",
          onClick: () => quitarDelCarrito(r.productoId),
          children: "Quitar"
        }
      )
    ] }, r.productoId)) }),
    /* @__PURE__ */ jsx("div", { className: "carrito__total", children: /* @__PURE__ */ jsxs("strong", { children: [
      "Total: $",
      total.toFixed(2),
      " MXN"
    ] }) }),
    !sesion ? /* @__PURE__ */ jsx("p", { className: "carrito__aviso", children: "Inicia sesion con Google (arriba, en el encabezado) para confirmar tu pedido." }) : /* @__PURE__ */ jsx(
      "button",
      {
        className: "boton boton--primario",
        onClick: confirmarPedido,
        disabled: procesando,
        children: procesando ? "Procesando..." : "Confirmar pedido"
      }
    ),
    error && /* @__PURE__ */ jsx("p", { className: "carrito__error", children: error }),
    /* @__PURE__ */ jsx("style", { children: `
        .carrito__lista { list-style: none; padding: 0; margin: 0 0 20px; }
        .carrito__renglon {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
        }
        .carrito__nombre small { color: var(--texto-secundario); }
        .carrito__total { font-size: 18px; margin-bottom: 16px; }
        .carrito__aviso { color: var(--texto-secundario); font-size: 14px; }
        .carrito__error { color: var(--error); margin-top: 10px; }
        .carrito-vacio, .checkout-ok { text-align: center; padding: 40px 0; }
      ` })
  ] });
}

const $$Carrito = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Carrito", "data-astro-cid-vrbpsbwj": true }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="contenedor" style="max-width: 720px; margin-top: 24px;" data-astro-cid-vrbpsbwj> <h1 data-astro-cid-vrbpsbwj>Tu carrito</h1> <!-- Toda esta pagina es una sola isla: el carrito vive en localStorage
         (nanostores), asi que no hay nada que el servidor pueda resolver
         de antemano. --> ${renderComponent($$result2, "CarritoCheckout", CarritoCheckout, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/components/CarritoCheckout.jsx", "client:component-export": "default", "data-astro-cid-vrbpsbwj": true })} </section>  ` })}`;
}, "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/carrito.astro", void 0);

const $$file = "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/pages/carrito.astro";
const $$url = "/carrito";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Carrito,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
