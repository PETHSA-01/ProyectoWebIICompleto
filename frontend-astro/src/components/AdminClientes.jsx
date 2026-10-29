import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoTicketEs,
  formatoFecha,
  formatoFechaHora,
  formatoMoneda,
  prioridadEs,
  tonoPrioridad,
  tonoTicket,
} from '../lib/formatos.js';
import { Drawer, Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';

const ESTADOS_TICKET = ['ABIERTO', 'EN_PROCESO', 'CERRADO'];

/**
 * Clientes: quién compra, cuánto y qué necesita. El perfil sale de agregar
 * pedidos y detalle_pedido (no hay tabla de perfiles duplicada). Los tickets
 * de soporte se atienden desde aquí.
 */
export default function AdminClientes() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [perfil, setPerfil] = useState(null); // { cliente, datos }
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.clientesAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirPerfil = async (cliente) => {
    setPerfil({ cliente, datos: null });
    setCargandoPerfil(true);
    setErrorPerfil(null);
    try {
      const data = await graphqlRequest(QUERIES.perfilCliente, { id: cliente.id });
      setPerfil({ cliente, datos: data });
    } catch (err) {
      setErrorPerfil(err.message);
    } finally {
      setCargandoPerfil(false);
    }
  };

  const recargarPerfil = async () => {
    if (!perfil) return;
    const data = await graphqlRequest(QUERIES.perfilCliente, { id: perfil.cliente.id });
    setPerfil({ cliente: perfil.cliente, datos: data });
    await cargar();
  };

  const cambiarTicket = async (id, estado) => {
    setGuardando(true);
    setErrorPerfil(null);
    try {
      await graphqlRequest(MUTATIONS.cambiarEstadoTicket, { id, estado });
      await recargarPerfil();
    } catch (err) {
      setErrorPerfil(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const crearTicket = async (datosTicket) => {
    setGuardando(true);
    setErrorPerfil(null);
    try {
      await graphqlRequest(MUTATIONS.crearTicketSoporte, {
        datos: { ...datosTicket, usuarioId: perfil.cliente.id },
      });
      await recargarPerfil();
      return true;
    } catch (err) {
      setErrorPerfil(err.message);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const clientes = useMemo(() => {
    const lista = datos?.clientes || [];
    const texto = buscar.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter(
      (c) =>
        c.nombre.toLowerCase().includes(texto) ||
        c.email.toLowerCase().includes(texto)
    );
  }, [datos, buscar]);

  const resumen = useMemo(() => {
    const lista = datos?.clientes || [];
    const conCompras = lista.filter((c) => c.totalPedidos > 0);
    const ticketsAbiertos = (datos?.ticketsSoporte || []).filter(
      (t) => t.estado !== 'CERRADO'
    ).length;
    return {
      total: lista.length,
      conCompras: conCompras.length,
      gasto: lista.reduce((s, c) => s + c.totalGastado, 0),
      promedio:
        conCompras.length > 0
          ? conCompras.reduce((s, c) => s + c.ticketPromedio, 0) / conCompras.length
          : 0,
      ticketsAbiertos,
    };
  }, [datos]);

  if (!datos && !error) return <Esqueleto filas={5} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Clientes</h1>
          <p className="panel-pagina__sub">
            Historial de compra, categoría favorita y tickets de soporte.
          </p>
        </div>
        <input
          className="buscador"
          type="search"
          placeholder="Buscar nombre o correo…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
      </header>

      <PanelError mensaje={error} />

      <div className="kpis">
        <Kpi etiqueta="Clientes registrados" valor={resumen.total} />
        <Kpi etiqueta="Con compras" valor={resumen.conCompras} />
        <Kpi etiqueta="Gasto acumulado" valor={formatoMoneda(resumen.gasto)} />
        <Kpi
          etiqueta="Tickets abiertos"
          valor={resumen.ticketsAbiertos}
          tono={resumen.ticketsAbiertos ? 'alerta' : 'ok'}
          detalle={`Ticket promedio ${formatoMoneda(resumen.promedio)}`}
        />
      </div>

      <div className="tabla-scroll">
        <table className="tabla tabla--clickeable">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="num">Pedidos</th>
              <th className="num">Gastado</th>
              <th className="num">Ticket promedio</th>
              <th>Última compra</th>
              <th className="num">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} onClick={() => abrirPerfil(c)}>
                <td>
                  <div className="persona">
                    <span className="avatar">{iniciales(c.nombre)}</span>
                    <span>
                      <strong>{c.nombre}</strong>
                      <small className="celda-sub">{c.email}</small>
                    </span>
                  </div>
                </td>
                <td className="num">{c.totalPedidos}</td>
                <td className="num">{formatoMoneda(c.totalGastado)}</td>
                <td className="num">{formatoMoneda(c.ticketPromedio)}</td>
                <td>{c.ultimaCompra ? formatoFecha(c.ultimaCompra) : '—'}</td>
                <td className="num">
                  {c.ticketsAbiertos > 0 ? (
                    <span className="badge badge--pending">{c.ticketsAbiertos}</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length === 0 && (
          <p className="panel-vacio">No hay clientes que coincidan con la búsqueda.</p>
        )}
      </div>

      {perfil && (
        <PerfilDrawer
          perfil={perfil}
          cargando={cargandoPerfil}
          error={errorPerfil}
          guardando={guardando}
          onCerrar={() => setPerfil(null)}
          onCambiarTicket={cambiarTicket}
          onCrearTicket={crearTicket}
        />
      )}
    </div>
  );
}

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function PerfilDrawer({ perfil, cargando, error, guardando, onCerrar, onCambiarTicket, onCrearTicket }) {
  const datos = perfil.datos;
  const detalle = datos?.perfilCliente;
  const tickets = datos?.ticketsSoporte || [];
  const pedidos = (datos?.pedidos || []).filter(
    (p) => String(p.usuario?.id) === String(perfil.cliente.id)
  );

  return (
    <Drawer titulo={perfil.cliente.nombre} ancho={640} onCerrar={onCerrar}>
      {cargando && <Esqueleto filas={4} />}
      <PanelError mensaje={error} />
      {detalle && (
        <div className="form-grid">
          <div className="ficha">
            <div>
              <small>Correo</small>
              <strong>{detalle.usuario.email}</strong>
            </div>
            <div>
              <small>Pedidos</small>
              <strong>{detalle.totalPedidos}</strong>
            </div>
            <div>
              <small>Gastado</small>
              <strong>{formatoMoneda(detalle.totalGastado)}</strong>
            </div>
            <div>
              <small>Ticket promedio</small>
              <strong>{formatoMoneda(detalle.ticketPromedio)}</strong>
            </div>
            <div>
              <small>Primera compra</small>
              <strong>{detalle.primeraCompra ? formatoFecha(detalle.primeraCompra) : '—'}</strong>
            </div>
            <div>
              <small>Última compra</small>
              <strong>{detalle.ultimaCompra ? formatoFecha(detalle.ultimaCompra) : '—'}</strong>
            </div>
          </div>

          <div className="ficha">
            <div>
              <small>Categoría favorita</small>
              <strong>{detalle.categoriaFavorita || 'Sin compras'}</strong>
            </div>
            <div>
              <small>Tickets abiertos</small>
              <strong>{detalle.ticketsAbiertos}</strong>
            </div>
          </div>

          <section>
            <h3 className="subtitulo">Productos más comprados</h3>
            {detalle.productosMasComprados.length > 0 ? (
              <ul className="lista-compacta">
                {detalle.productosMasComprados.map((p) => (
                  <li key={p.productoId}>
                    <span>{p.nombre}</span>
                    <strong>{p.cantidad} pza(s)</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-vacio">Todavía no tiene compras.</p>
            )}
          </section>

          <section>
            <h3 className="subtitulo">Pedidos ({pedidos.length})</h3>
            {pedidos.length > 0 ? (
              <ul className="lista-compacta">
                {pedidos.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <span>
                      #{p.id} · {formatoFecha(p.fecha)}
                    </span>
                    <strong>{formatoMoneda(p.total)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-vacio">Sin pedidos.</p>
            )}
          </section>

          <section>
            <h3 className="subtitulo">Tickets de soporte</h3>
            {tickets.length > 0 ? (
              <div className="tickets">
                {tickets.map((t) => (
                  <article key={t.id} className="ticket">
                    <div className="ticket__cabecera">
                      <strong>{t.asunto}</strong>
                      <span className={`badge badge--${tonoTicket(t.estado)}`}>
                        {estadoTicketEs(t.estado)}
                      </span>
                    </div>
                    <p>{t.descripcion}</p>
                    <small className="celda-sub">
                      {prioridadEs(t.prioridad)} · {formatoFechaHora(t.creadoEn)}
                    </small>
                    <div className="ticket__acciones">
                      {ESTADOS_TICKET.filter((e) => e !== t.estado).map((estado) => (
                        <button
                          key={estado}
                          type="button"
                          className="boton-mini"
                          disabled={guardando}
                          onClick={() => onCambiarTicket(t.id, estado)}
                        >
                          {estadoTicketEs(estado)}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel-vacio">Sin tickets registrados.</p>
            )}
          </section>

          <NuevoTicket onCrear={onCrearTicket} guardando={guardando} />

          <Nota>
            El perfil se calcula con los pedidos reales del cliente; no se guarda
            una copia que pueda quedar desactualizada.
          </Nota>
        </div>
      )}
    </Drawer>
  );
}

function NuevoTicket({ onCrear, guardando }) {
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('MEDIA');
  const [error, setError] = useState(null);

  const enviar = async () => {
    setError(null);
    if (!asunto.trim() || !descripcion.trim()) {
      setError('Asunto y descripción son obligatorios.');
      return;
    }
    const ok = await onCrear({ asunto: asunto.trim(), descripcion: descripcion.trim(), prioridad });
    if (ok) {
      setAsunto('');
      setDescripcion('');
      setPrioridad('MEDIA');
    }
  };

  return (
    <section className="form-grid">
      <h3 className="subtitulo">Nuevo ticket</h3>
      <div className="form-grid-2">
        <label className="campo">
          Asunto
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>
        <label className="campo">
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
          </select>
        </label>
      </div>
      <label className="campo">
        Descripción
        <textarea
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </label>
      <PanelError mensaje={error} />
      <button
        type="button"
        className="boton boton--secundario"
        disabled={guardando}
        onClick={enviar}
      >
        {guardando ? 'Guardando…' : 'Abrir ticket'}
      </button>
    </section>
  );
}
