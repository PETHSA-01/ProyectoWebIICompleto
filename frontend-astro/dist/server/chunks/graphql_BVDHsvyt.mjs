import { e as createComponent, n as renderHead, k as renderComponent, o as renderSlot, r as renderTemplate, h as createAstro } from './astro/server_Cpc1lNFO.mjs';
import 'piccolore';
/* empty css                           */
import { jsxs, jsx } from 'react/jsx-runtime';
import { useStore } from '@nanostores/react';
import { persistentAtom } from '@nanostores/persistent';
import { useRef, useState, useEffect } from 'react';
import { atom } from 'nanostores';

// $carrito guarda una lista de renglones { productoId, nombre, precio, cantidad }.
// Se usa persistentAtom (localStorage) para que el carrito sobreviva a
// recargar la pagina y, sobre todo, para que se comparta entre islas de
// React independientes (el boton "Agregar" en la pagina de producto y el
// icono/resumen del carrito en el encabezado) sin pasar props entre
// componentes que Astro renderiza por separado.
const $carrito = persistentAtom('nexoplay:carrito', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

function agregarAlCarrito(producto, cantidad = 1) {
  const actual = $carrito.get();
  const existente = actual.find((r) => r.productoId === producto.id);
  if (existente) {
    $carrito.set(
      actual.map((r) =>
        r.productoId === producto.id ? { ...r, cantidad: r.cantidad + cantidad } : r
      )
    );
  } else {
    $carrito.set([
      ...actual,
      { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad },
    ]);
  }
}

function quitarDelCarrito(productoId) {
  $carrito.set($carrito.get().filter((r) => r.productoId !== productoId));
}

function vaciarCarrito() {
  $carrito.set([]);
}

function CarritoResumen() {
  const carrito = useStore($carrito);
  const totalItems = carrito.reduce((acc, r) => acc + r.cantidad, 0);
  return /* @__PURE__ */ jsxs("a", { href: "/carrito", className: "carrito-resumen", children: [
    "🛒 Carrito",
    totalItems > 0 && /* @__PURE__ */ jsx("span", { className: "carrito-resumen__badge", children: totalItems }),
    /* @__PURE__ */ jsx("style", { children: `
        .carrito-resumen {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          color: var(--texto);
          font-weight: 600;
          font-size: 14px;
        }
        .carrito-resumen__badge {
          background: var(--violeta);
          color: white;
          border-radius: 999px;
          font-size: 11px;
          padding: 1px 7px;
        }
      ` })
  ] });
}

// Estado de sesion para las islas de React.
//
// Antes guardaba el JWT en localStorage, lo que hacia que cualquier script
// inyectado en la pagina (un XSS) pudiera leerlo y llevarselo. Ahora el token
// vive en una cookie httpOnly y este store solo conserva los datos publicos
// del usuario, que ademas llegan del servidor por props, asi que ni siquiera
// se guardan entre recargas.

// En memoria, no "persistentAtom": nada de esto se escribe en disco.
const $sesion = atom(null);

function iniciarSesion(usuario) {
  $sesion.set(usuario || null);
}

function cerrarSesion() {
  $sesion.set(null);
}

const CLIENT_ID = "983738489619-47afiu5jemougd5jma1qtqo8b9gtsr3o.apps.googleusercontent.com";
let promesaScript;
function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!promesaScript) {
    promesaScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        promesaScript = void 0;
        reject(new Error("No se pudo cargar el servicio de Google."));
      };
      document.body.appendChild(script);
    });
  }
  return promesaScript;
}
function LoginGoogle({ usuarioInicial = null }) {
  const sesion = useStore($sesion);
  const botonRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [avatarFallido, setAvatarFallido] = useState(false);
  useEffect(() => {
    setAvatarFallido(false);
  }, [sesion?.avatarUrl]);
  useEffect(() => {
    if (usuarioInicial) iniciarSesion(usuarioInicial);
    else if (!sesion) cerrarSesion();
  }, [usuarioInicial]);
  useEffect(() => {
    if (sesion || !CLIENT_ID) return;
    let cancelado = false;
    let botonPintado = false;
    const montarBoton = async () => {
      setCargando(true);
      setError(null);
      try {
        const google = await cargarScriptGoogle();
        if (cancelado) return;
        const respuesta = await fetch("/auth/sesion", { method: "GET" });
        if (!respuesta.ok) throw new Error("No se pudo preparar el inicio de sesion.");
        const { nonce } = await respuesta.json();
        if (cancelado) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce,
          callback: async (respuesta2) => {
            setCargando(true);
            setError(null);
            try {
              const res = await fetch("/auth/sesion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: respuesta2.credential })
              });
              const datos = await res.json();
              if (!res.ok) throw new Error(datos?.error || "No se pudo iniciar sesion.");
              iniciarSesion(datos.usuario);
            } catch (err) {
              setError(err.message);
            } finally {
              setCargando(false);
            }
          }
        });
        if (botonRef.current) {
          google.accounts.id.renderButton(botonRef.current, {
            theme: "outline",
            size: "medium",
            text: "signin_with"
          });
          botonPintado = true;
        }
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    montarBoton();
    return () => {
      cancelado = true;
      if (botonPintado) window.google?.accounts?.id?.cancel?.();
    };
  }, [sesion]);
  if (sesion) {
    const nombre = sesion.nombre || sesion.email || "Cuenta";
    const primerNombre = nombre.trim().split(/\s+/)[0] || "Cuenta";
    const iniciales = nombre.trim().split(/\s+/).slice(0, 2).map((palabra) => palabra.charAt(0).toUpperCase()).join("");
    return /* @__PURE__ */ jsxs("div", { className: "sesion-activa", children: [
      sesion.avatarUrl && !avatarFallido ? /* @__PURE__ */ jsx(
        "img",
        {
          src: sesion.avatarUrl.replace(/=s\d+c$/, "=s250-c"),
          alt: "",
          className: "sesion-activa__avatar",
          width: 28,
          height: 28,
          referrerPolicy: "no-referrer",
          onError: () => setAvatarFallido(true)
        }
      ) : (
        /* Si la foto no carga (bloqueo, cache, extension) o no hay foto,
           nunca dejamos el circulo roto: se muestran las iniciales. */
        /* @__PURE__ */ jsx("span", { className: "sesion-activa__avatar sesion-activa__iniciales", "aria-hidden": "true", children: iniciales })
      ),
      /* @__PURE__ */ jsx("span", { title: nombre, children: primerNombre.length > 28 ? `${primerNombre.slice(0, 28)}…` : primerNombre }),
      /* @__PURE__ */ jsx("a", { className: "boton boton--texto", href: "/auth/sesion?salir=1", children: "Salir" }),
      /* @__PURE__ */ jsx("style", { children: `
          .sesion-activa { display: flex; align-items: center; gap: 8px; font-size: 14px; }
          .sesion-activa__avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            object-fit: cover;
            aspect-ratio: 1 / 1;
            flex-shrink: 0;
            background: var(--surface-muted);
          }
          .sesion-activa__iniciales {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            color: #fff;
            background: var(--violeta);
          }
        ` })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { ref: botonRef }),
    cargando && /* @__PURE__ */ jsx("p", { style: { fontSize: 12 }, children: "Preparando…" }),
    error && /* @__PURE__ */ jsx("p", { role: "alert", style: { fontSize: 12, color: "var(--error)" }, children: error })
  ] });
}

const $$Astro = createAstro();
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const { title = "NexoPlay" } = Astro2.props;
  const usuarioInicial = Astro2.locals.sesion?.usuario ?? null;
  return renderTemplate`<html lang="es" data-astro-cid-37fxchfa> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} · NexoPlay</title>${renderHead()}</head> <body data-astro-cid-37fxchfa> <header class="topbar" data-astro-cid-37fxchfa> <div class="contenedor topbar__inner" data-astro-cid-37fxchfa> <a href="/" class="topbar__logo" data-astro-cid-37fxchfa>Nexo<span data-astro-cid-37fxchfa>Play</span></a> <nav class="topbar__nav" data-astro-cid-37fxchfa> <a href="/" data-astro-cid-37fxchfa>Inicio</a> </nav> <div class="topbar__acciones" data-astro-cid-37fxchfa> <!-- Islas de React: cada una hidrata por separado. La sesion ya no
               se reparte por localStorage (quedo expuesta a XSS): viaja en
               una cookie httpOnly que lee el middleware en el servidor, y de
               ahi sale usuarioInicial. El carrito sigue en localStorage,
               que no tiene datos sensibles. --> ${renderComponent($$result, "LoginGoogle", LoginGoogle, { "client:load": true, "usuarioInicial": usuarioInicial, "client:component-hydration": "load", "client:component-path": "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/components/LoginGoogle.jsx", "client:component-export": "default", "data-astro-cid-37fxchfa": true })} ${renderComponent($$result, "CarritoResumen", CarritoResumen, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/components/CarritoResumen.jsx", "client:component-export": "default", "data-astro-cid-37fxchfa": true })} </div> </div> </header> <main data-astro-cid-37fxchfa> ${renderSlot($$result, $$slots["default"])} </main> <footer class="footer" data-astro-cid-37fxchfa> <div class="contenedor" data-astro-cid-37fxchfa> <p data-astro-cid-37fxchfa>NexoPlay — Proyecto Final Programación Web II</p> </div> </footer>  </body> </html>`;
}, "/home/pethsa/Downloads/ProyectoWebIICompleto/frontend-astro/src/layouts/BaseLayout.astro", void 0);

const ENDPOINT = "http://localhost:4001/" ;
async function graphqlRequest(query, variables = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    const error = new Error(`Error de red (${response.status}) al consultar el servidor.`);
    error.status = response.status;
    throw error;
  }
  const { data, errors } = await response.json();
  if (errors && errors.length > 0) {
    const error = new Error(errors[0].message || "El servidor devolvio un error.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export { $carrito as $, $sesion as a, $$BaseLayout as b, agregarAlCarrito as c, graphqlRequest as g, quitarDelCarrito as q, vaciarCarrito as v };
