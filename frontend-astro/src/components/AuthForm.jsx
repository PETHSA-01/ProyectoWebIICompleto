import { useState } from 'react';
import GoogleBoton from './GoogleBoton.jsx';

function OjoAbierto() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OjoCerrado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * Formulario de acceso/registro de NexoPlay, presentado como una tarjeta
 * centrada de 420px. Al éxito la cookie httpOnly queda puesta y se redirige
 * al inicio (tanto el acceso normal como el de Google).
 */
export default function AuthForm({ modo = 'login' }) {
  const esLogin = modo === 'login';
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmacion, setVerConfirmacion] = useState(false);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);

    if (!esLogin && password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setProcesando(true);
    try {
      const cuerpo = esLogin
        ? { action: 'login', email, password }
        : { action: 'register', nombre, email, password };
      const respuesta = await fetch('/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo iniciar sesión.');

      window.location.assign('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <span className="auth__eyebrow">NexoPlay</span>
        <h1 className="auth__titulo">{esLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p className="auth__subtitulo">
          {esLogin
            ? 'Accede a tu cuenta para seguir comprando.'
            : 'Regístrate y recibe tu pedido en la puerta de tu casa.'}
        </p>

        <form className="auth__form" onSubmit={enviar} noValidate={false}>
          {!esLogin && (
            <label className="auth__campo">
              <span>Nombre</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoComplete="name"
                placeholder="Tu nombre"
              />
            </label>
          )}

          <label className="auth__campo">
            <span>Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
            />
          </label>

          <label className="auth__campo">
            <span>Contraseña</span>
            <div className="auth__campo-con-ojito">
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={esLogin ? 'current-password' : 'new-password'}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth__ojito"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={verPassword}
              >
                {verPassword ? <OjoCerrado /> : <OjoAbierto />}
              </button>
            </div>
          </label>

          {!esLogin && (
            <label className="auth__campo">
              <span>Confirmar contraseña</span>
              <div className="auth__campo-con-ojito">
                <input
                  type={verConfirmacion ? 'text' : 'password'}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth__ojito"
                  onClick={() => setVerConfirmacion((v) => !v)}
                  aria-label={verConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verConfirmacion}
                >
                  {verConfirmacion ? <OjoCerrado /> : <OjoAbierto />}
                </button>
              </div>
            </label>
          )}

          {error && (
            <p role="alert" className="auth__error">
              {error}
            </p>
          )}

          <GoogleBoton />

          <div className="auth__divisor"> </div>

          <button type="submit" className="boton boton--primario" disabled={procesando}>
            {procesando ? 'Procesando…' : esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth__pie">
          {esLogin ? (
            <>
              ¿No tienes cuenta? <a href="/registro">Regístrate aquí</a>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
            </>
          )}
        </p>
      </div>

      <style>{`
        .auth {
          display: flex;
          justify-content: center;
          padding: 48px 16px;
        }
        .auth__card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow);
          padding: 32px;
          display: flex;
          flex-direction: column;
        }
        .auth__eyebrow {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          text-align: center;
        }
        .auth__titulo {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.2;
          text-align: center;
          margin: 8px 0 4px;
        }
        .auth__subtitulo {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          margin: 0 0 24px;
        }
        .auth__form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth__campo {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
        }
        .auth__campo input {
          height: 44px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .auth__campo input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .auth__campo-con-ojito { position: relative; }
        .auth__campo-con-ojito input { width: 100%; padding-right: 44px; }
        .auth__ojito {
          position: absolute;
          top: 50%;
          right: 6px;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: var(--radius);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .auth__ojito:hover { color: var(--primary); background: var(--surface-2); }
        .auth__ojito svg { width: 20px; height: 20px; }
        .auth__error {
          color: var(--danger);
          font-size: 14px;
          margin: 0;
        }
        .auth__divisor {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 13px;
          margin: 4px 0;
        }
        .auth__divisor::before,
        .auth__divisor::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .auth__pie {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          margin: 20px 0 0;
        }
        .auth__pie a { color: var(--primary); font-weight: 600; }
      `}</style>
    </div>
  );
}