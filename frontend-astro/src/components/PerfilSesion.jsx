import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sesion, iniciarSesion, cerrarSesion } from '../stores/sesion.js';
import {
  IconoLogin,
  IconoOrdenes,
  IconoPanel,
  IconoRegistro,
  IconoSalir,
} from './Iconos.jsx';

/**
 * Dos estados en la topbar:
 *  - Sin sesión: botones-icono "Iniciar sesión" y "Registrarse" (con tooltip).
 *  - Con sesión: avatar (foto o iniciales) con el nombre que se desliza al
 *    pasar el cursor y un menú flotante con "Mis órdenes", "Panel Admin"
 *    (si aplica) y "Salir".
 *
 * La sesión llega por prop (SSR, desde la cookie httpOnly) y se vuelca al
 * store para que otras islas la vean. Salir es un enlace normal GET
 * (?salir=1): el servidor borra la cookie y redirige a /.
 */
export default function PerfilSesion({ usuarioInicial = null }) {
  const sesion = useStore($sesion);
  const cajaRef = useRef(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (usuarioInicial) iniciarSesion(usuarioInicial);
    else cerrarSesion();
  }, [usuarioInicial]);

  // Cerrar el menú al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return undefined;
    const alClicFuera = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    const alEsc = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEsc);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEsc);
    };
  }, [abierto]);

  if (!sesion) {
    return (
      <div className="perfil-anon">
        <a href="/login" className="accion-icono" aria-label="Iniciar sesión" title="Iniciar sesión">
          <IconoLogin size={20} />
          <span className="tooltip">Iniciar sesión</span>
        </a>
        <a
          href="/registro"
          className="accion-icono"
          aria-label="Registrarse"
          title="Registrarse"
        >
          <IconoRegistro size={20} />
          <span className="tooltip">Registrarse</span>
        </a>
      </div>
    );
  }

  const nombre = sesion.nombre || sesion.email || 'Cuenta';
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="perfil" ref={cajaRef}>
      <div className="perfil__nombre">{nombre}</div>
      <button
        type="button"
        className="perfil__avatar"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label="Menú de usuario"
      >
        {sesion.avatarUrl ? (
          <img src={sesion.avatarUrl} alt="" width={36} height={36} referrerPolicy="no-referrer" />
        ) : (
          <span className="perfil__iniciales" aria-hidden="true">
            {iniciales}
          </span>
        )}
      </button>

      {abierto && (
        <div className="perfil__menu" role="menu">
          <div className="perfil__cabecera">
            <strong>{nombre}</strong>
            {sesion.email && <span>{sesion.email}</span>}
          </div>
          <a href="/mis-ordenes" role="menuitem" onClick={() => setAbierto(false)}>
            <IconoOrdenes size={18} />
            Mis órdenes
          </a>
          {['ADMIN', 'OPERADOR'].includes(sesion.rol) && (
            <a href="/admin" role="menuitem" onClick={() => setAbierto(false)}>
              <IconoPanel size={18} />
              Panel Admin
            </a>
          )}
          <div className="perfil__divisor" />
          <a href="/auth/sesion?salir=1" role="menuitem" className="perfil__salir">
            <IconoSalir size={18} />
            Salir
          </a>
        </div>
      )}

      <style>{`
        .perfil-anon { display: flex; gap: 8px; align-items: center; }
        .perfil { position: relative; display: flex; align-items: center; }
        .perfil__nombre {
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 500;
          transition: max-width 200ms ease-out, opacity 150ms ease;
        }
        .perfil:hover .perfil__nombre,
        .perfil:focus-within .perfil__nombre {
          max-width: 140px;
          opacity: 1;
          margin-right: 8px;
        }
        .perfil__avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: transparent;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .perfil__avatar img { width: 100%; height: 100%; object-fit: cover; }
        .perfil__iniciales {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          background: var(--surface-2);
        }
        .perfil__menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 8px;
          z-index: 50;
        }
        .perfil__cabecera {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }
        .perfil__cabecera strong { font-size: 14px; font-weight: 600; }
        .perfil__cabecera span {
          font-size: 12px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .perfil__menu a {
          height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text);
          text-decoration: none;
        }
        .perfil__menu a:hover { background: var(--surface-2); }
        .perfil__divisor {
          height: 1px;
          background: var(--border);
          margin: 4px 0;
        }
        .perfil__salir { color: var(--danger) !important; }
      `}</style>
    </div>
  );
}