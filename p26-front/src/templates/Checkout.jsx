import { useState } from 'react';
import { useCarrito } from '../context/CarritoContext';
import { graphqlRequest } from '../graphql/client';
import { SkeletonDetalle } from '../components/Skeleton';

/**
 * Checkout — version completa.
 *
 * Conecta con la mutation real crearPedido del backend (usa un
 * usuarioId fijo, ver FAQ de la practica: login no es obligatorio en
 * P2-6). Incluye formulario de datos de envio/pago, validaciones,
 * y Skeleton mientras se procesa el pedido.
 */
const USUARIO_ID_FIJO = '2';

const MUTATION_CREAR_PEDIDO = `
  mutation CrearPedido($datos: PedidoInput!) {
    crearPedido(datos: $datos) {
      id
      total
      status
    }
  }
`;

export function Checkout({ onVolver, onPedidoCreado }) {
  const { items, totalPrecio, vaciarCarrito } = useCarrito();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    metodoPago: ''
  });

  const [touched, setTouched] = useState({
    nombre: false,
    direccion: false,
    metodoPago: false
  });

  const errores = {
    nombre: touched.nombre && form.nombre.trim().length < 2 ? 'Mínimo 2 caracteres' : '',
    direccion: touched.direccion && form.direccion.trim().length < 10 ? 'Mínimo 10 caracteres' : '',
    metodoPago: touched.metodoPago && !form.metodoPago ? 'Selecciona un método' : ''
  };

  const esValido = form.nombre.trim().length >= 2 &&
                   form.direccion.trim().length >= 10 &&
                   form.metodoPago !== '';

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const handleBlur = (campo) => {
    setTouched(prev => ({ ...prev, [campo]: true }));
  };

  const confirmar = () => {
    const erroresSubmit = {
      nombre: form.nombre.trim().length < 2 ? 'Mínimo 2 caracteres' : '',
      direccion: form.direccion.trim().length < 10 ? 'Mínimo 10 caracteres' : '',
      metodoPago: !form.metodoPago ? 'Selecciona un método' : ''
    };

    const hayErrores = Object.values(erroresSubmit).some(e => e !== '');
    if (hayErrores) {
      setTouched({ nombre: true, direccion: true, metodoPago: true });
      return;
    }

    setEnviando(true);
    setError(null);

    const datos = {
      usuarioId: USUARIO_ID_FIJO,
      detalles: items.map((it) => ({
        productoId: it.producto.id,
        cantidad: it.cantidad,
      })),
    };

    graphqlRequest(MUTATION_CREAR_PEDIDO, { datos })
      .then(() => {
        vaciarCarrito();
        onPedidoCreado();
      })
      .catch((err) => setError(err.message))
      .finally(() => setEnviando(false));
  };

  if (enviando) {
    return (
      <div className="contenedor pagina">
        <button className="boton boton--texto" onClick={onVolver} disabled>
          ← Volver al carrito
        </button>
        <h1 className="pagina__titulo">Procesando pedido...</h1>
        <SkeletonDetalle />
      </div>
    );
  }

  return (
    <div className="contenedor pagina">
      <button className="boton boton--texto" onClick={onVolver} disabled={enviando}>
        ← Volver al carrito
      </button>

      <h1 className="pagina__titulo">Checkout</h1>

      <p className="estado-vacio" style={{ textAlign: 'left', marginBottom: 24 }}>
        {items.length} {items.length === 1 ? 'producto' : 'productos'} · Total a pagar: $
        {totalPrecio.toFixed(2)}
      </p>

      <form onSubmit={(e) => { e.preventDefault(); confirmar(); }} noValidate className="formulario-checkout">
        <div className="campo">
          <label htmlFor="nombre">Nombre completo *</label>
          <input
            id="nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => handleChange('nombre', e.target.value)}
            onBlur={() => handleBlur('nombre')}
            className={errores.nombre ? 'error' : ''}
            aria-invalid={errores.nombre ? 'true' : 'false'}
            aria-describedby={errores.nombre ? 'error-nombre' : undefined}
          />
          {errores.nombre && <span id="error-nombre" className="campo__error">{errores.nombre}</span>}
        </div>

        <div className="campo">
          <label htmlFor="direccion">Dirección de envío *</label>
          <textarea
            id="direccion"
            value={form.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            onBlur={() => handleBlur('direccion')}
            className={errores.direccion ? 'error' : ''}
            aria-invalid={errores.direccion ? 'true' : 'false'}
            aria-describedby={errores.direccion ? 'error-direccion' : undefined}
            rows={3}
          />
          {errores.direccion && <span id="error-direccion" className="campo__error">{errores.direccion}</span>}
        </div>

        <div className="campo">
          <label htmlFor="metodoPago">Método de pago *</label>
          <select
            id="metodoPago"
            value={form.metodoPago}
            onChange={(e) => handleChange('metodoPago', e.target.value)}
            onBlur={() => handleBlur('metodoPago')}
            className={errores.metodoPago ? 'error' : ''}
            aria-invalid={errores.metodoPago ? 'true' : 'false'}
            aria-describedby={errores.metodoPago ? 'error-metodo' : undefined}
          >
            <option value="">Selecciona...</option>
            <option value="tarjeta">Tarjeta (simulado)</option>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo contra entrega</option>
          </select>
          {errores.metodoPago && <span id="error-metodo" className="campo__error">{errores.metodoPago}</span>}
        </div>

        {error && <p className="error-mensaje" role="alert">No se pudo registrar el pedido. {error}</p>}

        <button
          className="boton boton--primario"
          type="submit"
          disabled={!esValido}
        >
          Confirmar compra
        </button>
      </form>
    </div>
  );
}
