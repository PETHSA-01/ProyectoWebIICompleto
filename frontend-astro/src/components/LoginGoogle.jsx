import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sesion, iniciarSesion, cerrarSesion } from '../stores/sesion.js';

const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

// El script de Google Identity Services se carga una sola vez por pagina y
// se reutiliza. Antes se insertaba un <script> nuevo cada vez que cambiaba
// la sesion, y al hacer logout se volvia a insertar otro, dejando varios
// copies del script flotando en el DOM.
let promesaScript;
function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!promesaScript) {
    promesaScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        promesaScript = undefined;
        reject(new Error('No se pudo cargar el servicio de Google.'));
      };
      document.body.appendChild(script);
    });
  }
  return promesaScript;
}

/**
 * Isla de OAuth2 con Google.
 *
 * El boton oficial de "Sign in with Google" sigue siendo el mismo de siempre
 * (Google Identity Services), pero el resultado ya no se manda directo al
 * backend desde el navegador: se postea a /auth/sesion, y es el servidor de
 * Astro quien habla con el backend y guarda el JWT en una cookie httpOnly.
 * El token nunca vuelve al navegador, asi que un XSS ya no puede robarlo.
 *
 * El nonce se pide antes de montar el boton y viaja dentro del ID token que
 * devuelve Google. El servidor lo compara con el que guardo en una cookie
 * httpOnly de un solo uso: sin eso, un atacante podria pegarle a otra
 * persona su propio ID token de Google y dejarle la sesion iniciada a el.
 */
export default function LoginGoogle({ usuarioInicial = null }) {
  const sesion = useStore($sesion);
  const botonRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [avatarFallido, setAvatarFallido] = useState(false);

  // Si cambia el usuario (o vuelve a entrar con otra foto), reintentamos
  // cargar el avatar real; el fallback de iniciales solo cubre el fallo.
  useEffect(() => {
    setAvatarFallido(false);
  }, [sesion?.avatarUrl]);

  // El servidor ya sabe quien esta conectado (lo dejo en el middleware), asi
  // que se lo pasamos por prop y el store arranca con ese dato. Asi el
  // encabezado no parpadea ni un instante sin sesion al recargar.
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

        // GET /auth/sesion solo devuelve el nonce y, de paso, deja la cookie
        // httpOnly de un solo uso que despues valida el login.
        const respuesta = await fetch('/auth/sesion', { method: 'GET' });
        if (!respuesta.ok) throw new Error('No se pudo preparar el inicio de sesion.');
        const { nonce } = await respuesta.json();
        if (cancelado) return;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce,
          callback: async (respuesta) => {
            setCargando(true);
            setError(null);
            try {
              const res = await fetch('/auth/sesion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: respuesta.credential }),
              });
              const datos = await res.json();
              if (!res.ok) throw new Error(datos?.error || 'No se pudo iniciar sesion.');
              iniciarSesion(datos.usuario);
            } catch (err) {
              setError(err.message);
            } finally {
              setCargando(false);
            }
          },
        });

        if (botonRef.current) {
          google.accounts.id.renderButton(botonRef.current, {
            theme: 'outline',
            size: 'medium',
            text: 'signin_with',
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
      // cancel() desmonta el boton que Google injecto y evita que su
      // callback quede capturado aunque el script siga cargado.
      if (botonPintado) window.google?.accounts?.id?.cancel?.();
    };
  }, [sesion]);

  if (sesion) {
    const nombre = sesion.nombre || sesion.email || 'Cuenta';
    const primerNombre = nombre.trim().split(/\s+/)[0] || 'Cuenta';
    const iniciales = nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
    return (
      <div className="sesion-activa">
        {sesion.avatarUrl && !avatarFallido ? (
          <img
            src={sesion.avatarUrl.replace(/=s\d+c$/, '=s250-c')}
            alt=""
            className="sesion-activa__avatar"
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            onError={() => setAvatarFallido(true)}
          />
        ) : (
          /* Si la foto no carga (bloqueo, cache, extension) o no hay foto,
             nunca dejamos el circulo roto: se muestran las iniciales. */
          <span className="sesion-activa__avatar sesion-activa__iniciales" aria-hidden="true">
            {iniciales}
          </span>
        )}
        {/* Solo el primer nombre, mas legible; el nombre completo (tal como lo
            manda Google, sin tocar) queda en el tooltip. */}
        <span title={nombre}>
          {primerNombre.length > 28 ? `${primerNombre.slice(0, 28)}…` : primerNombre}
        </span>
        {/* Salir es un enlace normal (GET ?salir=1) y NO un fetch DELETE: el
            logout funciona aunque la isla no hidrate o el navegador bloquee
            fetch. El servidor borra la cookie y redirige al inicio. */}
        <a className="boton boton--texto" href="/auth/sesion?salir=1">
          Salir
        </a>
        <style>{`
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
        `}</style>
      </div>
    );
  }

  if (!CLIENT_ID) {
    return (
      <span style={{ fontSize: 12, color: 'var(--texto-secundario)' }}>
        (login no configurado)
      </span>
    );
  }

  return (
    <div>
      <div ref={botonRef} />
      {cargando && <p style={{ fontSize: 12 }}>Preparando…</p>}
      {error && (
        <p role="alert" style={{ fontSize: 12, color: 'var(--error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
