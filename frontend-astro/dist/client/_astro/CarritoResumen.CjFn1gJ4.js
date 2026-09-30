import{j as r}from"./index.C_yHiNZZ.js";import{u as a}from"./index.D39Fjc_8.js";import{$ as i}from"./carrito.CeadQMF2.js";import"./index.DK-fsZOb.js";function p(){const e=a(i).reduce((t,o)=>t+o.cantidad,0);return r.jsxs("a",{href:"/carrito",className:"carrito-resumen",children:["🛒 Carrito",e>0&&r.jsx("span",{className:"carrito-resumen__badge",children:e}),r.jsx("style",{children:`
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
      `})]})}export{p as default};
