import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import {
  estadoOCEs,
  formatoFecha,
  formatoMoneda,
  tonoOC,
} from '../lib/formatos.js';
import { Datos, Drawer, Esqueleto, Kpi, Nota, PanelError } from './AdminComunes.jsx';
import { IconoMas } from './Iconos.jsx';

const VACIO = {
  nombre: '',
  contacto: '',
  email: '',
  telefono: '',
  marcasDistribuidas: '',
  condicionesPago: 'CONTADO',
  diasCredito: '0',
  notas: '',
  activo: true,
};

// Valores del enum CondicionesPago (backend/db). Mantener sincronizados.
const CONDICIONES = [
  ['CONTADO', 'Contado'],
  ['CREDITO_30', 'Crédito 30 días'],
  ['CREDITO_60', 'Crédito 60 días'],
];

/**
 * Proveedores: directorio, condiciones de crédito y saldo pendiente (OC
 * recibidas a crédito). Solo ADMIN puede crear/editar; el OPERADOR consulta.
 */
export default function AdminProveedores({ rol = 'ADMIN' }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [drawer, setDrawer] = useState(null); // {tipo:'nuevo'|'editar'|'detalle', proveedor}
  const [guardando, setGuardando] = useState(false);
  const [errorDrawer, setErrorDrawer] = useState(null);
  const esAdmin = rol === 'ADMIN';

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await graphqlRequest(QUERIES.comprasAdmin));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const proveedores = useMemo(() => {
    const lista = datos?.proveedores || [];
    const texto = buscar.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter(
      (p) =>
        p.nombre.toLowerCase().includes(texto) ||
        String(p.marcasDistribuidas || '').toLowerCase().includes(texto)
    );
  }, [datos, buscar]);

  const resumen = useMemo(() => {
    const lista = datos?.proveedores || [];
    return {
      activos: lista.filter((p) => p.activo).length,
      credito: lista.filter((p) => p.condicionesPago !== 'CONTADO').length,
      saldo: lista.reduce((s, p) => s + p.saldoPendiente, 0),
      ordenes: (datos?.ordenesCompra || []).filter((o) => o.estado === 'BORRADOR').length,
    };
  }, [datos]);

  const cerrar = () => {
    setDrawer(null);
    setErrorDrawer(null);
  };

  const guardar = async (formulario) => {
    setGuardando(true);
    setErrorDrawer(null);
    try {
      const input = {
        nombre: formulario.nombre.trim(),
        contacto: formulario.contacto.trim() || null,
        email: formulario.email.trim() || null,
        telefono: formulario.telefono.trim() || null,
        marcasDistribuidas: formulario.marcasDistribuidas.trim() || null,
        condicionesPago: formulario.condicionesPago,
        diasCredito: Number(formulario.diasCredito) || 0,
        notas: formulario.notas.trim() || null,
        activo: formulario.activo,
      };
      if (drawer.tipo === 'editar') {
        await graphqlRequest(MUTATIONS.actualizarProveedor, { id: drawer.proveedor.id, datos: input });
      } else {
        await graphqlRequest(MUTATIONS.crearProveedor, { datos: input });
      }
      cerrar();
      await cargar();
    } catch (err) {
      setErrorDrawer(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!datos && !error) return <Esqueleto filas={4} />;

  return (
    <div className="panel-pagina">
      <header className="panel-pagina__cabecera">
        <div>
          <h1>Proveedores</h1>
          <p className="panel-pagina__sub">
            Directorio, condiciones de crédito y órdenes de compra.
          </p>
        </div>
        <div className="panel-acciones">
          <input
            className="buscador"
            type="search"
            placeholder="Buscar proveedor o marca…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          {esAdmin && (
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => setDrawer({ tipo: 'nuevo' })}
            >
              <IconoMas /> Nuevo
            </button>
          )}
        </div>
      </header>

      <PanelError mensaje={error} />

      {!esAdmin && (
        <Nota tono="alerta">
          Tu rol es OPERADOR: puedes consultar proveedores, pero crear y editar es
          una función de ADMIN.
        </Nota>
      )}

      <div className="kpis">
        <Kpi etiqueta="Proveedores activos" valor={resumen.activos} />
        <Kpi etiqueta="Con crédito" valor={resumen.credito} />
        <Kpi
          etiqueta="Saldo por pagar"
          valor={formatoMoneda(resumen.saldo)}
          detalle="OC recibidas a crédito"
        />
        <Kpi etiqueta="OC en borrador" valor={resumen.ordenes} />
      </div>

      <div className="tabla-scroll">
        <table className="tabla tabla--clickeable">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Marcas</th>
              <th>Condiciones</th>
              <th className="num">Días</th>
              <th className="num">Saldo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id} onClick={() => setDrawer({ tipo: 'detalle', proveedor: p })}>
                <td>
                  <strong>{p.nombre}</strong>
                  <small className="celda-sub">{p.email || 'Sin correo'}</small>
                </td>
                <td>{p.contacto || '—'}</td>
                <td>{p.marcasDistribuidas || '—'}</td>
                <td>{p.condicionesPago === 'CONTADO' ? 'Contado' : p.condicionesPago.replace('_', ' ')}</td>
                <td className="num">{p.diasCredito}</td>
                <td className="num">{formatoMoneda(p.saldoPendiente)}</td>
                <td>
                  <span className={`badge badge--${p.activo ? 'ok' : 'neutral'}`}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {proveedores.length === 0 && <p className="panel-vacio">Sin proveedores.</p>}
      </div>

      {(drawer?.tipo === 'nuevo' || drawer?.tipo === 'editar') && (
        <FormProveedor
          proveedor={drawer.tipo === 'editar' ? drawer.proveedor : null}
          guardando={guardando}
          error={errorDrawer}
          onCerrar={cerrar}
          onGuardar={guardar}
        />
      )}

      {drawer?.tipo === 'detalle' && (
        <DetalleProveedor
          proveedor={drawer.proveedor}
          ordenes={(datos?.ordenesCompra || []).filter(
            (o) => String(o.proveedor?.id) === String(drawer.proveedor.id)
          )}
          esAdmin={esAdmin}
          onCerrar={cerrar}
          onEditar={() => setDrawer({ tipo: 'editar', proveedor: drawer.proveedor })}
        />
      )}
    </div>
  );
}

function FormProveedor({ proveedor, onCerrar, onGuardar, guardando, error }) {
  const [formulario, setFormulario] = useState(
    proveedor
      ? {
          nombre: proveedor.nombre,
          contacto: proveedor.contacto || '',
          email: proveedor.email || '',
          telefono: proveedor.telefono || '',
          marcasDistribuidas: proveedor.marcasDistribuidas || '',
          condicionesPago: proveedor.condicionesPago,
          diasCredito: String(proveedor.diasCredito),
          notas: proveedor.notas || '',
          activo: proveedor.activo,
        }
      : VACIO
  );

  const cambiar = (campo, valor) => setFormulario((f) => ({ ...f, [campo]: valor }));

  return (
    <Drawer
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={guardando || !formulario.nombre.trim()}
            onClick={() => onGuardar(formulario)}
          >
            {guardando ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="campo">
          Nombre *
          <input value={formulario.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
        </label>
        <div className="form-grid-2">
          <label className="campo">
            Contacto
            <input value={formulario.contacto} onChange={(e) => cambiar('contacto', e.target.value)} />
          </label>
          <label className="campo">
            Teléfono
            <input value={formulario.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />
          </label>
        </div>
        <label className="campo">
          Correo
          <input
            type="email"
            value={formulario.email}
            onChange={(e) => cambiar('email', e.target.value)}
          />
        </label>
        <label className="campo">
          Marcas que distribuye
          <input
            value={formulario.marcasDistribuidas}
            onChange={(e) => cambiar('marcasDistribuidas', e.target.value)}
            placeholder="Sony, Microsoft, Nintendo…"
          />
        </label>
        <div className="form-grid-2">
          <label className="campo">
            Condiciones de pago
            <select
              value={formulario.condicionesPago}
              onChange={(e) => {
                const valor = e.target.value;
                const dias = valor === 'CONTADO' ? '0' : valor.replace('CREDITO_', '');
                setFormulario((f) => ({ ...f, condicionesPago: valor, diasCredito: dias }));
              }}
            >
              {CONDICIONES.map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Días de crédito
            <input
              type="number"
              min="0"
              value={formulario.diasCredito}
              onChange={(e) => cambiar('diasCredito', e.target.value)}
            />
          </label>
        </div>
        <label className="campo">
          Notas
          <textarea rows={3} value={formulario.notas} onChange={(e) => cambiar('notas', e.target.value)} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={formulario.activo}
            onChange={(e) => cambiar('activo', e.target.checked)}
          />
          Proveedor activo
        </label>
        <PanelError mensaje={error} />
      </div>
    </Drawer>
  );
}

function DetalleProveedor({ proveedor, ordenes, esAdmin, onCerrar, onEditar }) {
  return (
    <Drawer
      titulo={proveedor.nombre}
      onCerrar={onCerrar}
      pie={
        esAdmin ? (
          <button type="button" className="boton boton--primario" onClick={onEditar}>
            Editar proveedor
          </button>
        ) : null
      }
    >
      <div className="form-grid">
        <Datos
          filas={[
            ['Contacto', proveedor.contacto],
            ['Correo', proveedor.email],
            ['Teléfono', proveedor.telefono],
            ['Marcas', proveedor.marcasDistribuidas],
            ['Condiciones', proveedor.condicionesPago.replace('_', ' ')],
            ['Días de crédito', proveedor.diasCredito],
            ['Saldo pendiente', formatoMoneda(proveedor.saldoPendiente)],
            ['Estado', proveedor.activo ? 'Activo' : 'Inactivo'],
          ]}
        />
        {proveedor.notas && <Nota>{proveedor.notas}</Nota>}

        <h3 className="subtitulo">Órdenes de compra ({ordenes.length})</h3>
        {ordenes.length > 0 ? (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>OC</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{formatoFecha(o.fecha)}</td>
                    <td>
                      <span className={`badge badge--${tonoOC(o.estado)}`}>
                        {estadoOCEs(o.estado)}
                      </span>
                    </td>
                    <td className="num">{formatoMoneda(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-vacio">Sin órdenes de compra registradas.</p>
        )}

        <Nota>
          El saldo pendiente suma las OC recibidas a crédito. El sistema no registra
          pagos a proveedores: es un control de compromisos, no un módulo de tesorería.
        </Nota>
      </div>
    </Drawer>
  );
}
