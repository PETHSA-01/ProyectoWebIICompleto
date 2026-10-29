import { useEffect, useRef, useState } from 'react';
import { iniciarSesion } from '../stores/sesion.js';

const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

// El script de Google Identity Services se carga una sola vez por pagina.
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
 * Botón "Continuar con Google" que va dentro del formulario de acceso, bajo
 * los campos y arriba del botón de envío. Sin client id configurado (caso
 * local) se pinta un botón visible con un aviso, para que el diseño siempre
 * muestre la opción de entrada por Google.
 *
 * El flujo es el mismo de siempre (Google Identity Services + nonce), pero
 * tras validar en /auth/sesion se redirige al inicio: ese es el
 * comportamiento que se pidió para el login con Google.
 */
export default function GoogleBoton() {
  const botonRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!CLIENT_ID || !botonRef.current) return undefined;

    let cancelado = false;
    let botonPintado = false;

    const montarBoton = async () => {
      setCargando(true);
      try {
        const google = await cargarScriptGoogle();
        if (cancelado) return;

        const respuesta = await fetch('/auth/sesion', { method: 'GET' });
        if (!respuesta.ok) throw new Error('No se pudo preparar el inicio de sesión.');
        const { nonce } = await respuesta.json();
        if (cancelado) return;

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce,
          callback: async (res) => {
            setCargando(true);
            setError(null);
            try {
              const resp = await fetch('/auth/sesion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: res.credential }),
              });
              const datos = await resp.json();
              if (!resp.ok) throw new Error(datos?.error || 'No se pudo iniciar sesión.');
              iniciarSesion(datos.usuario);
              window.location.assign('/');
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
            text: 'continue_with',
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
  }, []);

  if (!CLIENT_ID) {
    return (
      <div className="google">
        <button
          type="button"
          className="google__fallback"
          onClick={() => setError('Continuar con Google no está configurado en este entorno.')}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuar con Google
        </button>
        {cargando && <p className="google__nota">Preparando…</p>}
        {error && (
          <p role="alert" className="google__error">
            {error}
          </p>
        )}
        <style>{`
          .google { display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .google__fallback {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            height: 44px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg);
            color: var(--text);
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: border-color 0.15s ease, background 0.15s ease;
          }
          .google__fallback:hover { border-color: var(--primary); background: var(--surface-2); }
          .google__fallback svg { width: 18px; height: 18px; }
          .google__nota { font-size: 13px; color: var(--text-muted); margin: 0; }
          .google__error { font-size: 14px; color: var(--danger); margin: 0; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="google">
      <div ref={botonRef} className="google__boton" />
      {cargando && <p className="google__nota">Preparando…</p>}
      {error && (
        <p role="alert" className="google__error">
          {error}
        </p>
      )}
      <style>{`
        .google { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .google__boton { min-height: 44px; }
        .google__nota { font-size: 13px; color: var(--text-muted); margin: 0; }
        .google__error { font-size: 14px; color: var(--danger); margin: 0; }
      `}</style>
    </div>
  );
}