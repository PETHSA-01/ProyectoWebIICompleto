import { useEffect, useState } from 'react';

/**
 * Selector de cantidad con formato "- 1 +": botones de decremento/incremento
 * y un input numérico en medio para escribir la cantidad exacta. El rango se
 * limita entre 1 y el stock disponible. El valor "real" vive en el padre
 * (prop `cantidad`); aquí solo se mantiene un buffer de texto mientras se
 * escribe.
 */
export default function CantidadSelector({ cantidad, onCambio, stock, disabled = false }) {
  const [texto, setTexto] = useState(String(cantidad));
  const tope = Math.max(1, Math.floor(Number(stock)) || 1);

  useEffect(() => {
    setTexto(String(cantidad));
  }, [cantidad]);

  const aplicar = (valor) => {
    let n = Math.floor(Number(valor));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > tope) n = tope;
    onCambio(n);
  };

  const salto = (delta) => {
    const actual = Math.min(Number(cantidad) || 1, tope);
    aplicar(actual + delta);
  };

  return (
    <div className={`selector-cantidad${disabled ? ' selector-cantidad--deshabilitado' : ''}`}>
      <button
        type="button"
        className="selector-cantidad__btn"
        onClick={() => salto(-1)}
        disabled={disabled || Number(cantidad) <= 1}
        aria-label="Disminuir cantidad"
      >
        −
      </button>
      <input
        type="number"
        className="selector-cantidad__input"
        value={texto}
        min={1}
        max={tope}
        disabled={disabled}
        aria-label="Cantidad"
        onChange={(e) => {
          setTexto(e.target.value);
          if (e.target.value !== '') aplicar(e.target.value);
        }}
        onBlur={() => setTexto(String(cantidad))}
      />
      <button
        type="button"
        className="selector-cantidad__btn"
        onClick={() => salto(1)}
        disabled={disabled || Number(cantidad) >= tope}
        aria-label="Aumentar cantidad"
      >
        +
      </button>

      <style>{`
        .selector-cantidad {
          display: inline-flex;
          align-items: center;
          height: 40px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg);
          overflow: hidden;
          flex-shrink: 0;
        }
        .selector-cantidad__btn {
          width: 34px;
          height: 100%;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }
        .selector-cantidad__btn:hover:not(:disabled) {
          background: var(--surface-2);
        }
        .selector-cantidad__btn:disabled {
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .selector-cantidad__input {
          width: 46px;
          height: 100%;
          border: none;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          font-weight: 600;
          text-align: center;
          appearance: textfield;
        }
        .selector-cantidad__input::-webkit-inner-spin-button,
        .selector-cantidad__input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .selector-cantidad__input:focus {
          outline: none;
          background: var(--surface-2);
        }
        .selector-cantidad--deshabilitado { opacity: 0.6; }
      `}</style>
    </div>
  );
}