import { useState } from 'react';
import { graphqlRequest, MUTATIONS } from '../lib/graphql.js';
import { formatoMoneda } from '../lib/formatos.js';

/**
 * Pago en efectivo en tienda OXXO (Checkout API de Mercado Pago).
 *
 * A diferencia de la tarjeta, OXXO no cobra al instante: el backend genera
 * una ficha (ticket) que el cliente lleva impresa a cualquier tienda OXXO.
 * El cobro queda PENDIENTE hasta que OXXO lo confirme, así que aquí se
 * muestra la ficha y un botón para verificar el pago más tarde.
 *
 * `ticket` (opcional) reabre una ficha ya generada al retomar un cobro
 * pendiente desde Mis Órdenes, en vez de emitir un ticket nuevo.
 */
export default function PagoOxxo({ pedidoId, total, payerEmail, ticket, onVolver }) {
  const [email, setEmail] = useState(payerEmail || '');
  const [ficha, setFicha] = useState(ticket?.url ? ticket : null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const generarFicha = async () => {
    if (procesando) return;
    if (!email.trim()) {
      setError('Necesitamos tu correo para la confirmación de OXXO.');
      return;
    }
    setProcesando(true);
    setError(null);
    try {
      const data = await graphqlRequest(MUTATIONS.procesarPagoOxxo, {
        pedidoId: String(pedidoId),
        datos: { payerEmail: email.trim() },
      });
      setFicha(data.procesarPagoOxxo);
    } catch (err) {
      setError(`No se pudo generar la ficha: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const verificarPago = () => {
    window.location.assign(`/pago/resultado?pedido=${pedidoId}&proveedor=oxxo`);
  };

  return (
    <div className="oxxo">
      <p className="oxxo__resumen">
        Pedido <strong>#{pedidoId}</strong> · Total <strong>{formatoMoneda(total)}</strong>
      </p>

      {ficha ? (
        <>
          <div className="oxxo__ficha">
            <span className="oxxo__ficha-titulo">Ficha de pago OXXO</span>
            <span className="oxxo__referencia">
              <span>Referencia</span>
              <strong>{ficha.referencia || '—'}</strong>
            </span>
            {ficha.expira && (
              <span className="oxxo__expira">
                Paga antes del {new Date(ficha.expira).toLocaleString('es-MX')}
              </span>
            )}
          </div>

          <p className="oxxo__instrucciones">
            Lleva esta ficha (o su código de barras) a cualquier tienda OXXO y
            paga el total en efectivo. Tu pedido quedará confirmado cuando OXXO
            acredite el pago; puedes verificar el estado aquí cuando quieras.
          </p>

          {ficha.url && (
            <a
              href={ficha.url}
              target="_blank"
              rel="noopener noreferrer"
              className="boton boton--primario boton--oxxo"
            >
              Abrir / imprimir ficha
            </a>
          )}

          <button type="button" className="boton boton--secundario" onClick={verificarPago}>
            Ya pagué · Verificar estado
          </button>
        </>
      ) : (
        <>
          <label className="oxxo__campo">
            <span>Correo para la confirmación de OXXO</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              disabled={procesando}
            />
          </label>

          <button
            type="button"
            className="boton boton--primario boton--oxxo"
            onClick={generarFicha}
            disabled={procesando}
          >
            {procesando ? 'Generando ficha…' : 'Generar ficha OXXO'}
          </button>
        </>
      )}

      {error && <p className="oxxo__error">{error}</p>}

      {onVolver && (
        <button type="button" className="boton boton--texto" onClick={onVolver} disabled={procesando}>
          Volver a elegir método de pago
        </button>
      )}

      <style>{`
        .oxxo { display: flex; flex-direction: column; gap: 14px; }
        .oxxo__resumen { margin: 0; font-size: 15px; }
        .oxxo__resumen strong { color: var(--primary); }
        .oxxo__ficha {
          display: flex; flex-direction: column; gap: 8px;
          background: var(--surface-2, var(--surface)); border: 1px solid var(--border);
          border-top: 4px solid #e60028; border-radius: var(--radius-md); padding: 16px;
        }
        .oxxo__ficha-titulo {
          font-size: 13px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #e60028;
        }
        .oxxo__referencia { display: flex; flex-direction: column; gap: 2px; }
        .oxxo__referencia span { font-size: 12px; color: var(--text-muted); }
        .oxxo__referencia strong {
          font-size: 22px; font-weight: 800; letter-spacing: 0.08em;
          font-variant-numeric: tabular-nums;
        }
        .oxxo__expira { font-size: 13px; color: var(--text-muted); }
        .oxxo__instrucciones { margin: 0; font-size: 14px; color: var(--text-muted); }
        .oxxo__campo { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
        .oxxo__campo input {
          font: inherit; padding: 10px 12px; border: 1px solid var(--border);
          border-radius: var(--radius-md); background: var(--surface); color: var(--text);
        }
        .oxxo__campo input:focus { outline: 2px solid var(--primary); border-color: var(--primary); }
        .oxxo__error { color: var(--danger); font-size: 14px; margin: 0; }
        .boton--oxxo { background: #e60028; border-color: #e60028; color: #fff; }
        .boton--oxxo:hover:not(:disabled) { filter: brightness(0.94); }
      `}</style>
    </div>
  );
}
