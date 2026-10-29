import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  formatoFecha,
  formatoMoneda,
  paqueteriaEs,
} from '../lib/formatos.js';
import { Drawer, Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';

const PAQUETERIAS = [
  ['SIMULADA', 'Simulada (sin credenciales)'],
  ['DHL', 'DHL'],
  ['ESTAFETA', 'Estafeta'],
  ['FEDEX', 'FedEx'],
];

const COLUMNAS = [
  { estado: 'CONFIRMED', titulo: 'Por enviar', clase: 'kanban--pendiente' },
  { estado: 'SHIPPED', titulo: 'En tránsito', clase: 'kanban--transito' },
  { estado: 'DELIVERED', titulo: 'Entregados', clase: 'kanban--ok' },
];

/**
 * Logística: tablero de envíos. Un pedido pagado (CONFIRMED) se despacha
 * generando su guía; al generarla pasa a SHIPPED. Marcar entregado cierra el
 * ciclo (DELIVERED). Toda transición queda en la bitácora del pedido.
 */
export default function TableroEnvios() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(null); // pedido a enviar
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);
  const [confirmarEntrega, setConfirmarEntrega] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.enviosAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pedidos = useMemo(() => {
    const lista = datos?.pedidos || [];
    return {
      CONFIRMED: lista.filter((p) => p.status === 'CONFIRMED'),
      SHIPPED: lista.filter((p) => p.status === 'SHIPPED'),
      DELIVERED: lista.filter((p) => p.status === 'DELIVERED').slice(0, 12),
    };
  }, [datos]);

  const conGuia = useMemo(
    () => (datos?.pedidos || []).filter((p) => p.envio).length,
    [datos]
  );

  const simuladas = useMemo(
    () => (datos?.pedidos || []).filter((p) => p.envio?.simulada).length,
    [datos]
  );

  const cerrar = () => {
    setDrawer(null);
    setErrorDrawer(null);
  };

  const generar = async (paqueteria, paquete) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      await graphqlRequest(MUTATIONS.crearGuia, {
        pedidoId: drawer.id,
        paqueteria,
        paquete,
      });
      cerrar();
      await cargar();
    } catch (err) {
      setErrorDrawer(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const entregar = async (pedidoId) => {
    setGuardando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.marcarEntregado, { pedidoId });
      setConfirmarEntrega(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={4} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Envíos</h1>
          <p className="panel-pagina__sub">
            Tablero de despacho: guías, tránsito y entregas confirmadas.
          </p>
        </div>
        <button type="button" className="boton boton--secundario" onClick={cargar}>
          Actualizar
        </button>
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi
          etiqueta="Por enviar"
          valor={pedidos.CONFIRMED.length}
          tono={pedidos.CONFIRMED.length ? 'alerta' : 'ok'}
        />
        <Kpi etiqueta="En tránsito" valor={pedidos.SHIPPED.length} />
        <Kpi etiqueta="Con guía" valor={conGuia} />
        <Kpi
          etiqueta="Guías simuladas"
          valor={simuladas}
          detalle="Sin credenciales de paquetería"
          tono={simuladas ? 'alerta' : 'ok'}
        />
      </div>

      <Nota>
        Las guías se generan con el adaptador de paquetería. Sin credenciales en{' '}
        <code>.env</code> se emite una guía <strong>SIMULADA</strong> con el formato
        real del folio, marcada como simulada: nunca se presenta como guía real.
      </Nota>

      <div className="kanban">
        {COLUMNAS.map((columna) => (
          <section key={columna.estado} className={`kanban__columna ${columna.clase}`}>
            <header className="kanban__cabecera">
              <h2>{columna.titulo}</h2>
              <span className="kanban__conteo">{pedidos[columna.estado].length}</span>
            </header>

            {pedidos[columna.estado].map((p) => (
              <article key={p.id} className="kanban__tarjeta">
                <div className="kanban__tarjeta-cabecera">
                  <strong>#{p.id}</strong>
                  <span>{formatoMoneda(p.total)}</span>
                </div>
                <p className="kanban__cliente">{p.usuario?.nombre}</p>
                <p className="kanban__direccion">
                  {p.direccionEnvio || 'Sin dirección capturada'}
                  <br />
                  {[p.ciudad, p.estadoGeo, p.codigoPostal].filter(Boolean).join(', ')}
                </p>
                <p className="kanban__detalle">
                  {(p.detalles || [])
                    .map((d) => `${d.cantidad}× ${d.producto?.nombre}`)
                    .join(' · ')}
                </p>

                {p.envio && (
                  <div className="kanban__guia">
                    <span>
                      {paqueteriaEs(p.envio.paqueteria)} · {p.envio.numeroGuia}
                    </span>
                    {p.envio.simulada && (
                      <span className="badge badge--pending">Simulada</span>
                    )}
                    {p.envio.fechaEntregaEstimada && (
                      <small>Entrega estimada: {formatoFecha(p.envio.fechaEntregaEstimada)}</small>
                    )}
                    {p.envio.urlRastreo && (
                      <a href={p.envio.urlRastreo} target="_blank" rel="noreferrer">
                        Rastrear
                      </a>
                    )}
                  </div>
                )}

                {p.status === 'CONFIRMED' && (
                  <button
                    type="button"
                    className="boton boton--primario boton--bloque"
                    onClick={() => setDrawer(p)}
                  >
                    Generar guía
                  </button>
                )}

                {p.status === 'SHIPPED' &&
                  (confirmarEntrega === p.id ? (
                    <div className="botones-confirmar">
                      <button
                        type="button"
                        className="boton-mini"
                        onClick={() => setConfirmarEntrega(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="boton-mini boton-mini--primario"
                        disabled={guardando}
                        onClick={() => entregar(p.id)}
                      >
                        Sí, entregado
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="boton boton--secundario boton--bloque"
                      onClick={() => setConfirmarEntrega(p.id)}
                    >
                      Marcar entregado
                    </button>
                  ))}

                {p.status === 'DELIVERED' && p.envio?.entregadoEn && (
                  <small className="kanban__fecha">
                    Entregado: {formatoFecha(p.envio.entregadoEn)}
                  </small>
                )}
              </article>
            ))}

            {pedidos[columna.estado].length === 0 && (
              <p className="kanban__vacio">Sin pedidos en esta etapa.</p>
            )}
          </section>
        ))}
      </div>

      {drawer && (
        <FormGuia
          pedido={drawer}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrar}
          onGenerar={generar}
        />
      )}
    </div>
  );
}

function FormGuia({ pedido, onCerrar, onGenerar, guardando, error }) {
  const [paqueteria, setPaqueteria] = useState('SIMULADA');
  const [peso, setPeso] = useState('1');
  const [largo, setLargo] = useState('30');
  const [ancho, setAncho] = useState('20');
  const [alto, setAlto] = useState('10');

  return (
    <Drawer
      titulo={`Guía del pedido #${pedido.id}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={guardando}
            onClick={() =>
              onGenerar(paqueteria, {
                pesoKg: Number(peso) || 0,
                largoCm: Number(largo) || 0,
                anchoCm: Number(ancho) || 0,
                altoCm: Number(alto) || 0,
              })
            }
          >
            {guardando ? 'Generando…' : 'Generar guía'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <p>
          <strong>{pedido.usuario?.nombre}</strong>
          <br />
          <small className="celda-sub">
            {pedido.direccionEnvio || 'Sin dirección'} ·{' '}
            {[pedido.ciudad, pedido.estadoGeo, pedido.codigoPostal].filter(Boolean).join(', ')}
          </small>
        </p>

        <label className="campo">
          Paquetería
          <select value={paqueteria} onChange={(e) => setPaqueteria(e.target.value)}>
            {PAQUETERIAS.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <div className="form-grid-2">
          <label className="campo">
            Peso (kg)
            <input type="number" min="0.1" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </label>
          <label className="campo">
            Largo (cm)
            <input type="number" min="1" step="1" value={largo} onChange={(e) => setLargo(e.target.value)} />
          </label>
          <label className="campo">
            Ancho (cm)
            <input type="number" min="1" step="1" value={ancho} onChange={(e) => setAncho(e.target.value)} />
          </label>
          <label className="campo">
            Alto (cm)
            <input type="number" min="1" step="1" value={alto} onChange={(e) => setAlto(e.target.value)} />
          </label>
        </div>

        <Nota>
          Al generar la guía el pedido pasa automáticamente a <strong>En tránsito</strong>{' '}
          y la transición queda registrada en su historial.
        </Nota>

        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}
