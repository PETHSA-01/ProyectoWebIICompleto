import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';
import { formatoMoneda } from '../lib/formatos.js';
import { IconoCerrar, IconoEditar, IconoEliminar, IconoMas } from './Iconos.jsx';

const FORM_VACIO = {
  nombre: '',
  precio: '',
  stock: '',
  imagen: '',
  categoriaId: '',
  costoAdquisicion: '0',
  sku: '',
  stockMinimo: '5',
};

function Esqueleto() {
  return (
    <div className="skeleton">
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
    </div>
  );
}

/** Panel de productos: tabla con tarjetas editables en un drawer lateral. */
export default function AdminProductos() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);

  const [drawer, setDrawer] = useState(null); // { modo, productoId } | null
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo, texto }

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await graphqlRequest(QUERIES.catalogoAdmin);
      setCategorias(d.categorias);
      setProductos(d.productos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esCrear = drawer?.modo === 'crear';
  const tituloDrawer = esCrear ? 'Nuevo producto' : 'Editar producto';

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setMensaje(null);
    setDrawer({ modo: 'crear' });
  };

  const abrirEditar = (p) => {
    setForm({
      nombre: p.nombre,
      precio: String(p.precio),
      stock: String(p.stock),
      imagen: p.imagen || '',
      categoriaId: p.categoria?.id ? String(p.categoria.id) : '',
      costoAdquisicion: String(p.costoAdquisicion ?? 0),
      sku: p.sku || '',
      stockMinimo: String(p.stockMinimo ?? 5),
    });
    setMensaje(null);
    setDrawer({ modo: 'editar', productoId: p.id });
  };

  const cerrarDrawer = () => {
    if (!guardando) {
      setDrawer(null);
      setMensaje(null);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        precio: Number(form.precio),
        stock: Number(form.stock),
        imagen: form.imagen.trim() || null,
        categoriaId: form.categoriaId || null,
        costoAdquisicion: Number(form.costoAdquisicion) || 0,
        sku: form.sku.trim() || null,
        stockMinimo: Number(form.stockMinimo) || 0,
      };
      if (esCrear) {
        await graphqlRequest(MUTATIONS.crearProducto, { datos });
      } else {
        await graphqlRequest(MUTATIONS.actualizarProducto, {
          id: String(drawer.productoId),
          datos,
        });
      }
      setDrawer(null);
      await cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar el producto: ${err.message}` });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (p) => {
    if (
      !window.confirm(
        `¿Desactivar "${p.nombre}"? Dejará de mostrarse en la tienda; su historial de ventas e inventario se conserva.`
      )
    )
      return;
    setGuardando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.eliminarProducto, { id: String(p.id) });
      await cargar();
    } catch (err) {
      setError(`No se pudo desactivar: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarForm = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const categoriasOrdenadas = useMemo(
    () => [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categorias]
  );

  if (cargando) return <Esqueleto />;

  return (
    <div>
      {error && <p className="panel-error">{error}</p>}

      <div className="admin-toolbar">
        <button className="boton boton--primario" onClick={abrirCrear}>
          <IconoMas size={18} />
          Nuevo producto
        </button>
      </div>

      {productos.length === 0 ? (
        <p className="panel-vacio">Aún no hay productos. Crea el primero con "Nuevo producto".</p>
      ) : (
        <table className="tabla tabla--clickeable" style={{ marginTop: '16px' }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} onClick={() => abrirEditar(p)}>
                <td style={{ maxWidth: '240px' }}>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                      verticalAlign: 'middle',
                    }}
                  >
                    {p.nombre}
                  </span>
                </td>
                <td>{p.categoria?.nombre || '—'}</td>
                <td style={{ fontWeight: 600 }}>{formatoMoneda(p.precio)}</td>
                <td>
                  <span
                    className={`badge ${
                      p.stock === 0
                        ? 'badge--bad'
                        : p.bajoMinimo
                          ? 'badge--pending'
                          : 'badge--ok'
                    }`}
                    title={`Umbral: ${p.stockMinimo}`}
                  >
                    {p.stock}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="accion-icono"
                    title="Editar"
                    aria-label={`Editar ${p.nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditar(p);
                    }}
                  >
                    <IconoEditar size={18} />
                  </button>
                  <button
                    type="button"
                    className="accion-icono"
                    title="Eliminar"
                    aria-label={`Desactivar ${p.nombre}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminar(p);
                    }}
                    disabled={guardando}
                  >
                    <IconoEliminar size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={cerrarDrawer} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={tituloDrawer}>
            <div className="drawer__cabecera">
              <h2>{tituloDrawer}</h2>
              <button
                type="button"
                className="drawer__boton-x"
                onClick={cerrarDrawer}
                aria-label="Cerrar"
              >
                <IconoCerrar size={20} />
              </button>
            </div>

            <form id="producto-form" className="drawer__contenido form-grid" onSubmit={guardar}>
              <label className="campo">
                <span>Nombre</span>
                <input
                  value={form.nombre}
                  onChange={(e) => cambiarForm('nombre', e.target.value)}
                  required
                  placeholder="Ej. Control inalámbrico Xbox"
                />
              </label>

              <div className="form-grid-2">
                <label className="campo">
                  <span>Precio (MXN)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio}
                    onChange={(e) => cambiarForm('precio', e.target.value)}
                    required
                    placeholder="0.00"
                  />
                </label>
                <label className="campo">
                  <span>Stock</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(e) => cambiarForm('stock', e.target.value)}
                    required
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label className="campo">
                  <span>Costo de adquisición (MXN)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costoAdquisicion}
                    onChange={(e) => cambiarForm('costoAdquisicion', e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <label className="campo">
                  <span>Umbral de stock bajo</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stockMinimo}
                    onChange={(e) => cambiarForm('stockMinimo', e.target.value)}
                    placeholder="5"
                  />
                </label>
              </div>

              <label className="campo">
                <span>SKU (opcional)</span>
                <input
                  value={form.sku}
                  onChange={(e) => cambiarForm('sku', e.target.value)}
                  placeholder="Ej. XBOX-CTRL-BLK"
                />
              </label>

              <label className="campo">
                <span>Categoría</span>
                <select
                  value={form.categoriaId}
                  onChange={(e) => cambiarForm('categoriaId', e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {categoriasOrdenadas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="campo">
                <span>URL de la imagen</span>
                <input
                  value={form.imagen}
                  onChange={(e) => cambiarForm('imagen', e.target.value)}
                  placeholder="https://…"
                />
              </label>

              {form.imagen && (
                <img
                  src={form.imagen}
                  alt="Vista previa"
                  style={{
                    width: '88px',
                    height: '88px',
                    objectFit: 'contain',
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                    padding: 6,
                  }}
                />
              )}

              {mensaje?.tipo === 'error' && <p className="panel-error">{mensaje.texto}</p>}
            </form>

            <div className="drawer__pie">
              <button className="boton boton--secundario" onClick={cerrarDrawer} disabled={guardando}>
                Cancelar
              </button>
              <button
                className="boton boton--primario"
                disabled={guardando}
                type="submit"
                form="producto-form"
              >
                {guardando ? 'Guardando…' : esCrear ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .admin-toolbar { display: flex; justify-content: flex-end; }
        .admin-toolbar .boton { height: 40px; display: inline-flex; align-items: center; gap: 6px; }
      `}</style>
    </div>
  );
}