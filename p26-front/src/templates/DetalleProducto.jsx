import { useEffect, useState } from 'react';
import { graphqlRequest, QUERIES } from '../graphql/client';
import { SkeletonDetalle } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { ImagenProducto } from '../components/ImagenProducto';

/**
 * DetalleProducto: informacion del producto + selector de cantidad.
 * Decision documentada (seccion 5.4 de la practica): se implementa como
 * un template mas del flujo, no como modal con Portal, para mantener la
 * navegacion consistente con el resto de la maquina de estados.
 */
export function DetalleProducto({ productoId, onAgregarAlCarrito, onVolver }) {
  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cantidad, setCantidad] = useState(1);

  const cargar = () => {
    setCargando(true);
    setError(null);
    graphqlRequest(QUERIES.producto, { id: productoId })
      .then((data) => {
        setProducto(data.producto);
        setCantidad(1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  const cambiarCantidad = (delta) => {
    setCantidad((actual) => {
      const siguiente = actual + delta;
      if (siguiente < 1) return 1;
      if (producto && siguiente > producto.stock) return producto.stock;
      return siguiente;
    });
  };

  if (error) {
    return (
      <div className="contenedor pagina">
        <button className="boton boton--texto" onClick={onVolver}>
          ← Volver
        </button>
        <ErrorMessage mensaje={error} onReintentar={cargar} />
      </div>
    );
  }

  if (cargando || !producto) {
    return (
      <div className="contenedor pagina">
        <button className="boton boton--texto" onClick={onVolver}>
          ← Volver
        </button>
        <SkeletonDetalle />
      </div>
    );
  }

  const sinStock = producto.stock === 0;

  return (
    <div className="contenedor pagina">
      <button className="boton boton--texto" onClick={onVolver}>
        ← Volver a {producto.categoria.nombre}
      </button>

      <div className="detalle-producto">
        <div className="detalle-producto__imagen">
          <ImagenProducto src={producto.imagen} alt={producto.nombre} grande />
        </div>

        <div className="detalle-producto__info">
          <p className="detalle-producto__categoria">{producto.categoria.nombre}</p>
          <h1>{producto.nombre}</h1>
          <p className="detalle-producto__precio">${producto.precio.toFixed(2)}</p>

          <p className={sinStock ? 'detalle-producto__stock detalle-producto__stock--agotado' : 'detalle-producto__stock'}>
            {sinStock ? 'Sin stock disponible' : `${producto.stock} disponibles`}
          </p>

          {!sinStock && (
            <>
              <div className="selector-cantidad">
                <span className="visually-hidden">Cantidad</span>
                <button
                  className="selector-cantidad__boton"
                  onClick={() => cambiarCantidad(-1)}
                  aria-label="Disminuir cantidad"
                  disabled={cantidad <= 1}
                >
                  −
                </button>
                <span className="selector-cantidad__valor">{cantidad}</span>
                <button
                  className="selector-cantidad__boton"
                  onClick={() => cambiarCantidad(1)}
                  aria-label="Aumentar cantidad"
                  disabled={cantidad >= producto.stock}
                >
                  +
                </button>
              </div>

              <button
                className="boton boton--primario detalle-producto__boton-agregar"
                onClick={() => onAgregarAlCarrito(producto, cantidad)}
              >
                Agregar {cantidad} al carrito — ${(producto.precio * cantidad).toFixed(2)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
