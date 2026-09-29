/**
 * Tema 3 (props): recibe el producto ya resuelto del padre.
 * Tema 5 (eventos custom): "onVerProducto" avisa al template superior en
 * vez de que la tarjeta sepa navegar por si misma.
 */
import { ImagenProducto } from './ImagenProducto';

export function ProductoCard({ producto, onVerProducto }) {
  const sinStock = producto.stock === 0;

  return (
    <article className="producto-card">
      <div className="producto-card__imagen">
        <ImagenProducto src={producto.imagen} alt={producto.nombre} />
        {sinStock && <span className="etiqueta etiqueta--agotado">Sin stock</span>}
      </div>
      <>
        <h3 className="producto-card__nombre">{producto.nombre}</h3>
        <p className="producto-card__precio">${producto.precio.toFixed(2)}</p>
        <button
          className="boton boton--primario producto-card__boton"
          onClick={() => onVerProducto(producto.id)}
        >
          Ver producto
        </button>
      </>
    </article>
  );
}
