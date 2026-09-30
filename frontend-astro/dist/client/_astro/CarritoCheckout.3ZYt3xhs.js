import{j as o}from"./index.C_yHiNZZ.js";import{r as u}from"./index.DK-fsZOb.js";import{u as p}from"./index.D39Fjc_8.js";import{q as h,v as b,$ as f}from"./carrito.CeadQMF2.js";import{$ as g}from"./sesion.DaVF3ZrD.js";const j={crearPedido:`
    mutation CrearPedido($d: PedidoInput!) {
      crearPedido(datos: $d) {
        id
        total
        status
        detalles { cantidad subtotal producto { nombre } }
      }
    }
  `,iniciarSesionGoogle:`
    mutation IniciarSesionGoogle($idToken: String!) {
      iniciarSesionGoogle(idToken: $idToken) {
        token
        usuario { id nombre email rol avatarUrl }
      }
    }
  `},_="/api/graphql";async function v(s,n={},c=null){const a=await fetch(_,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:s,variables:n})});if(!a.ok){const e=new Error(`Error de red (${a.status}) al consultar el servidor.`);throw e.status=a.status,e}const{data:l,errors:i}=await a.json();if(i&&i.length>0){const e=new Error(i[0].message||"El servidor devolvio un error.");throw e.status=a.status,e}return l}function y(){const s=p(f),n=p(g),[c,d]=u.useState(!1),[a,l]=u.useState(null),[i,e]=u.useState(null),m=s.reduce((r,t)=>r+t.precio*t.cantidad,0),x=async()=>{d(!0),e(null);try{const r=await v(j.crearPedido,{d:{detalles:s.map(t=>({productoId:t.productoId,cantidad:t.cantidad}))}},n.token);l(r.crearPedido),b()}catch(r){e(r.status===401?"Tu sesion expiro. Sal y vuelve a entrar con Google para confirmar el pedido.":r.message)}finally{d(!1)}};return a?o.jsxs("div",{className:"checkout-ok",children:[o.jsx("h2",{children:"¡Pedido confirmado!"}),o.jsxs("p",{children:["Pedido #",a.id," — Total: $",Number(a.total).toFixed(2)," MXN"]}),o.jsx("ul",{children:a.detalles.map((r,t)=>o.jsxs("li",{children:[r.cantidad,"x ",r.producto.nombre," — $",Number(r.subtotal).toFixed(2)]},t))}),o.jsx("a",{href:"/",className:"boton boton--primario",children:"Seguir comprando"})]}):s.length===0?o.jsxs("div",{className:"carrito-vacio",children:[o.jsx("p",{children:"Tu carrito esta vacio."}),o.jsx("a",{href:"/",className:"boton boton--secundario",children:"Ver catalogo"})]}):o.jsxs("div",{className:"carrito",children:[o.jsx("ul",{className:"carrito__lista",children:s.map(r=>o.jsxs("li",{className:"carrito__renglon",children:[o.jsxs("span",{className:"carrito__nombre",children:[r.nombre," ",o.jsxs("small",{children:["x",r.cantidad]})]}),o.jsxs("span",{children:["$",(r.precio*r.cantidad).toFixed(2)]}),o.jsx("button",{className:"boton boton--texto boton--peligro",onClick:()=>h(r.productoId),children:"Quitar"})]},r.productoId))}),o.jsx("div",{className:"carrito__total",children:o.jsxs("strong",{children:["Total: $",m.toFixed(2)," MXN"]})}),n?o.jsx("button",{className:"boton boton--primario",onClick:x,disabled:c,children:c?"Procesando...":"Confirmar pedido"}):o.jsx("p",{className:"carrito__aviso",children:"Inicia sesion con Google (arriba, en el encabezado) para confirmar tu pedido."}),i&&o.jsx("p",{className:"carrito__error",children:i}),o.jsx("style",{children:`
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
      `})]})}export{y as default};
