import { useEffect, useState } from 'react';
import { IconoLuna, IconoSol } from './Iconos.jsx';

export const CLAVE_TEMA = 'nexoplay_tema';

function temaActual() {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  if (guardado === 'light' || guardado === 'dark') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Selector de tema claro/oscuro. El html ya trae [data-theme] aplicado por el
 * script inline del layout (para no parpadear); esta isla solo lo alterna y
 * lo recuerda en localStorage.
 */
export default function ThemeToggle({ compacto = false }) {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    setOscuro(temaActual() === 'dark');
  }, []);

  const alternar = () => {
    const siguiente = temaActual() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = siguiente;
    localStorage.setItem(CLAVE_TEMA, siguiente);
    setOscuro(siguiente === 'dark');
  };

  return (
    <button
      type="button"
      className="tema-toggle"
      onClick={alternar}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
    >
      {oscuro ? <IconoSol size={20} /> : <IconoLuna size={20} />}
      <style>{`
        .tema-toggle {
          width: ${compacto ? 32 : 40}px;
          height: ${compacto ? 32 : 40}px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: var(--text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
          flex-shrink: 0;
        }
        .tema-toggle:hover {
          background: var(--surface-2);
        }
      `}</style>
    </button>
  );
}