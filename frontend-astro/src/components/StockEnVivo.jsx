import { useStockEnVivo } from '../lib/stockEnVivo.js';

/**
 * Texto de disponibilidad que se actualiza solo (suscripcion GraphQL).
 * variante "detalle" = pagina del producto; "card" = tarjeta del catalogo.
 */
export default function StockEnVivo({ productoId, stockInicial, variante = 'detalle' }) {
  const { stock } = useStockEnVivo(productoId, stockInicial);

  if (variante === 'card') {
    return stock > 0 ? <span className="producto-card__stock">{stock} disponibles</span> : null;
  }
  return (
    <p className={`detalle__stock ${stock > 0 ? '' : 'detalle__stock--agotado'}`}>
      {stock > 0 ? `${stock} disponibles` : 'Sin stock por el momento'}
    </p>
  );
}
