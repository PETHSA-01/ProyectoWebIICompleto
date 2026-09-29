import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sesion, iniciarSesion, cerrarSesion } from '../stores/sesion.js';
import { graphqlRequest, MUTATIONS } from '../lib/graphql.js';

const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Isla de OAuth2 con Google. Carga el script de Google Identity Services,
 * dibuja el boton oficial de "Sign in with Google" y, cuando el usuario
 * inicia sesion, manda el ID token al backend (mutacion iniciarSesionGoogle)
 * para que lo verifique y devuelva un JWT propio de NexoPlay.
 *
 * Ese JWT (no el ID token de Google) es el que se guarda en $sesion y el
 * que usan las demas islas (ej. checkout) para autenticarse contra el
 * backend GraphQL y, potencialmente, contra PostgREST directamente.
 */
export default function LoginGoogle() {
  const sesion = useStore($sesion);
  const botonRef = useRef(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sesion || !CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (respuesta) => {
          setCargando(true);
          setError(null);
          try {
            const data = await graphqlRequest(MUTATIONS.iniciarSesionGoogle, {
              idToken: respuesta.credential,
            });
            iniciarSesion(data.iniciarSesionGoogle);
          } catch (err) {
            setError(err.message);
          } finally {
            setCargando(false);
          }
        },
      });
      if (botonRef.current) {
        window.google?.accounts.id.renderButton(botonRef.current, {
          theme: 'outline',
          size: 'medium',
          text: 'signin_with',
        });
      }
    };
    document.body.appendChild(script);
    return () => script.remove();
  }, [sesion]);

  if (sesion) {
    return (
      <div className="sesion-activa">
        {sesion.usuario.avatarUrl && (
          <img src={sesion.usuario.avatarUrl} alt="" className="sesion-activa__avatar" />
        )}
        <span>{sesion.usuario.nombre}</span>
        <button className="boton boton--texto" onClick={cerrarSesion}>
          Salir
        </button>
        <style>{`
          .sesion-activa { display: flex; align-items: center; gap: 8px; font-size: 14px; }
          .sesion-activa__avatar { width: 28px; height: 28px; border-radius: 50%; }
        `}</style>
      </div>
    );
  }

  if (!CLIENT_ID) {
    return <span style={{ fontSize: 12, color: 'var(--texto-secundario)' }}>(login no configurado)</span>;
  }

  return (
    <div>
      <div ref={botonRef} />
      {cargando && <p style={{ fontSize: 12 }}>Iniciando sesion...</p>}
      {error && <p style={{ fontSize: 12, color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}
