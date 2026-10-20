import { useEffect, useMemo, useState } from 'react';
import { vaciarCarrito } from '../stores/carrito.js';
import { graphqlRequest } from '../lib/graphql.js';
import { MUTATIONS } from '../lib/queries.js';
import { formatoMoneda } from '../lib/formatos.js';
import { IconoAlerta, IconoCheck, IconoReloj } from './Iconos.jsx';

/**
 * Pantalla /pago/resultado?pedido=N&proveedor=...
 *
 * Destino tras pagar. Con Mercado Pago (Checkout API) se llega aquí después
 * de procesar la tarjeta con el brick; con PayPal, al volver de su sitio. En
 * ambos casos consulta el estado REAL del cobro contra la API de la pasarela
 * (los webhooks no llegan a un localhost en desarrollo) y, si quedó PENDIENTE,
 * reintenta unos segundos. Si el pago queda APROBADO se vacía el carrito
 * (reservado al crear el pedido) y se muestra el pedido confirmado.
 */
export default function ResultadoPago({ pedido, proveedor, estadoQuery }) {
  const [estado, setEstado] = useState('VIENDO'); // 'VIENDO' | 'OK' | 'ERROR' | 'ESPERA'
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  const proveedorTitulo = useMemo(
    () =>
      proveedor === 'paypal'
        ? 'PayPal'
        : proveedor === 'oxxo'
          ? 'OXXO'
          : proveedor === 'mercadopago'
            ? 'Mercado Pago'
            : 'pasarela',
    [proveedor]
  );

  useEffect(() => {
    if (!pedido) {
      setEstado('ERROR');
      setError('Falta el identificador del pedido en la URL.');
      return;
    }

    // PayPal regresa con estado=cancelado si el comprador no aprobó; MP con
    // estado=failure si el cobro rechazó. En ambos casos el pedido sigue
    // pendiente y se puede reintentar.
    if (estadoQuery === 'cancelado' || estadoQuery === 'failure') {
      setEstado('ERROR');
      setError(
        'El pago no se completó. Tu pedido sigue esperando y puedes intentarlo de nuevo cuando quieras.'
      );
      return;
    }

    let activo = true;
    const consultar = async () => {
      setEstado('VIENDO');
      setError(null);
      try {
        const resultado = await graphqlRequest(MUTATIONS.verificarPago, {
          pedidoId: String(pedido),
        });
        if (!activo) return;
        const p = resultado.verificarPago;
        setInfo(p);

        const esAprobado = p.estadoPago === 'APROBADO' || p.status === 'DELIVERED';
        const esTerminal = ['APROBADO', 'RECHAZADO', 'REEMBOLSADO'].includes(p.estadoPago);

        if (esAprobado) {
          vaciarCarrito();
          setEstado('OK');
        } else if (proveedor === 'oxxo' && (p.estadoPago === 'PENDIENTE' || p.estadoPago == null)) {
          // OXXO no se cobra al instante: queda PENDIENTE hasta que el cliente
          // paga la ficha en la tienda. No tiene sentido reintentar en bucle.
          setEstado('TIENDA');
        } else if (p.estadoPago === 'PENDIENTE' || p.estadoPago === null || p.estadoPago === undefined) {
          // MP a veces tarda unos segundos en reflejar el pago.
          setTimeout(() => {
            if (activo) consultar();
          }, 3000);
          setEstado('ESPERA');
        } else if (esTerminal) {
          setEstado('ERROR');
          setError('La pasarela reportó que el pago no se completó.');
        } else {
          setEstado('ERROR');
          setError('No se pudo confirmar el pago.');
        }
      } catch (err) {
        if (!activo) return;
        setEstado('ERROR');
        setError(err.message);
      }
    };

    consultar();
    return () => {
      activo = false;
    };
  }, [pedido, estadoQuery]);

  const recalcular = () => {
    setEstado('VIENDO');
    setError(null);
    graphqlRequest(MUTATIONS.verificarPago, { pedidoId: String(pedido) })
      .then((r) => {
        setInfo(r.verificarPago);
        if (r.verificarPago.estadoPago === 'APROBADO') {
          vaciarCarrito();
          setEstado('OK');
        } else if (proveedor === 'oxxo') {
          // Sigue pendiente en tienda: se mantiene la ficha a la vista.
          setEstado('TIENDA');
        } else {
          setEstado('ERROR');
          setError('El cobro aún no aparece como aprobado.');
        }
      })
      .catch((err) => setError(err.message));
  };

  if (estado === 'ESPERA') {
    return (
      <div className="resultado">
        <span className="resultado__icono resultado__icono--espera">
          <IconoReloj size={40} />
        </span>
        <h1>Verificando tu pago…</h1>
        <p>Estamos confirmando el cobro con la pasarela. Un momento por favor.</p>
        <style>{ESTILOS}</style>
      </div>
    );
  }

  if (estado === 'TIENDA') {
    return (
      <div className="resultado">
        <span className="resultado__icono resultado__icono--espera">
          <IconoReloj size={40} />
        </span>
        <h1>Ficha OXXO pendiente de pago</h1>
        <p>
          Tu pedido <strong>#{pedido}</strong> quedó apartado. Paga la ficha en
          cualquier tienda OXXO; en cuanto se acredite lo verás confirmado aquí.
        </p>
        {info?.referenciaPago && (
          <p className="resultado__meta">
            Referencia OXXO: <strong>{info.referenciaPago}</strong>
          </p>
        )}
        <div className="resultado__acciones">
          {info?.ticketUrl && (
            <a
              href={info.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="boton boton--primario"
            >
              Abrir / imprimir ficha
            </a>
          )}
          <button className="boton boton--secundario" onClick={recalcular}>
            Ya pagué · Verificar
          </button>
          <a href="/mis-ordenes" className="boton boton--texto">
            Ver mis órdenes
          </a>
        </div>
        <style>{ESTILOS}</style>
      </div>
    );
  }

  if (estado === 'ERROR' || (estado !== 'OK' && info && info.estadoPago !== 'APROBADO')) {
    const esCancel = estadoQuery === 'cancelado' || estadoQuery === 'failure';
    return (
      <div className="resultado">
        <span className="resultado__icono resultado__icono--fallo">
          <IconoAlerta size={40} />
        </span>
        <h1>La pasarela no confirmó el cobro</h1>
        {error ? <p>{error}</p> : <p>El pago no quedó registrado.</p>}
        <div className="resultado__acciones">
          {esCancel ? (
            <a href="/mis-ordenes" className="boton boton--primario">
              Volver a mis órdenes
            </a>
          ) : (
            <button className="boton boton--primario" onClick={recalcular}>
              Volver a consultar
            </button>
          )}
          <a href="/" className="boton boton--texto">
            Seguir comprando
          </a>
        </div>
        <style>{ESTILOS}</style>
      </div>
    );
  }

  if (estado === 'OK' && info) {
    return (
      <div className="resultado">
        <span className="resultado__icono resultado__icono--ok">
          <IconoCheck size={40} />
        </span>
        <h1>¡Pago aprobado!</h1>
        <p>
          Tu pedido <strong>#{info.id}</strong> se pagó con {proveedorTitulo} por{' '}
          <strong>{formatoMoneda(info.total)}</strong>.
        </p>
        {info.fechaPago && (
          <p className="resultado__meta">
            Pagado el {new Date(info.fechaPago).toLocaleString('es-MX')}
          </p>
        )}
        <div className="resultado__acciones">
          <a href="/mis-ordenes" className="boton boton--primario">
            Ver mis órdenes
          </a>
          <a href="/" className="boton boton--texto">
            Seguir comprando
          </a>
        </div>
        <style>{ESTILOS}</style>
      </div>
    );
  }

  return (
    <div className="resultado">
      <p className="resultado__cargando">Verificando pago…</p>
      <style>{ESTILOS}</style>
    </div>
  );
}

const ESTILOS = `
  .resultado {
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 40px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 560px;
    margin: 0 auto;
  }
  .resultado__icono {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }
  .resultado__icono--ok { color: var(--st-ok-fg); background: var(--st-ok-bg); }
  .resultado__icono--fallo { color: var(--st-bad-fg); background: var(--st-bad-bg); }
  .resultado__icono--espera { color: var(--st-pending-fg); background: var(--st-pending-bg); }
  .resultado h1 { font-size: 28px; font-weight: 700; margin: 0; }
  .resultado p { margin: 0; color: var(--text-muted); font-size: 15px; }
  .resultado__meta { font-size: 13px !important; }
  .resultado__acciones {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 260px;
    margin-top: 8px;
  }
  .resultado__cargando { color: var(--text-muted); }
`;