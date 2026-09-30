import{j as t}from"./index.C_yHiNZZ.js";import{r as s}from"./index.DK-fsZOb.js";import{u as E}from"./index.D39Fjc_8.js";import{i as v,c as S,$ as _}from"./sesion.DaVF3ZrD.js";const x="983738489619-47afiu5jemougd5jma1qtqo8b9gtsr3o.apps.googleusercontent.com";let u;function N(){return window.google?.accounts?.id?Promise.resolve(window.google):(u||(u=new Promise((n,e)=>{const r=document.createElement("script");r.src="https://accounts.google.com/gsi/client",r.async=!0,r.onload=()=>n(window.google),r.onerror=()=>{u=void 0,e(new Error("No se pudo cargar el servicio de Google."))},document.body.appendChild(r)})),u)}function T({usuarioInicial:n=null}){const e=E(_),r=s.useRef(null),[w,c]=s.useState(!1),[f,l]=s.useState(null),[j,p]=s.useState(!1);if(s.useEffect(()=>{p(!1)},[e?.avatarUrl]),s.useEffect(()=>{n?v(n):e||S()},[n]),s.useEffect(()=>{if(e||!x)return;let o=!1,a=!1;return(async()=>{c(!0),l(null);try{const i=await N();if(o)return;const g=await fetch("/auth/sesion",{method:"GET"});if(!g.ok)throw new Error("No se pudo preparar el inicio de sesion.");const{nonce:y}=await g.json();if(o)return;i.accounts.id.initialize({client_id:x,nonce:y,callback:async b=>{c(!0),l(null);try{const d=await fetch("/auth/sesion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:b.credential})}),h=await d.json();if(!d.ok)throw new Error(h?.error||"No se pudo iniciar sesion.");v(h.usuario)}catch(d){l(d.message)}finally{c(!1)}}}),r.current&&(i.accounts.id.renderButton(r.current,{theme:"outline",size:"medium",text:"signin_with"}),a=!0)}catch(i){o||l(i.message)}finally{o||c(!1)}})(),()=>{o=!0,a&&window.google?.accounts?.id?.cancel?.()}},[e]),e){const o=e.nombre||e.email||"Cuenta",a=o.trim().split(/\s+/)[0]||"Cuenta",m=o.trim().split(/\s+/).slice(0,2).map(i=>i.charAt(0).toUpperCase()).join("");return t.jsxs("div",{className:"sesion-activa",children:[e.avatarUrl&&!j?t.jsx("img",{src:e.avatarUrl.replace(/=s\d+c$/,"=s250-c"),alt:"",className:"sesion-activa__avatar",width:28,height:28,referrerPolicy:"no-referrer",onError:()=>p(!0)}):t.jsx("span",{className:"sesion-activa__avatar sesion-activa__iniciales","aria-hidden":"true",children:m}),t.jsx("span",{title:o,children:a.length>28?`${a.slice(0,28)}…`:a}),t.jsx("a",{className:"boton boton--texto",href:"/auth/sesion?salir=1",children:"Salir"}),t.jsx("style",{children:`
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
        `})]})}return t.jsxs("div",{children:[t.jsx("div",{ref:r}),w&&t.jsx("p",{style:{fontSize:12},children:"Preparando…"}),f&&t.jsx("p",{role:"alert",style:{fontSize:12,color:"var(--error)"},children:f})]})}export{T as default};
