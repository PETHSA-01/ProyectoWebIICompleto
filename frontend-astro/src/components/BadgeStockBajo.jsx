// Contador de productos bajo su umbral, para el sidebar del panel. Es una
// isla mínima: si falla la consulta simplemente no muestra nada.
import { useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES } from '../lib/queries.js';

export default function BadgeStockBajo() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let vivo = true;
    graphqlRequest(QUERIES.resumenDashboard)
      .then((data) => {
        if (vivo) setTotal(data.resumenDashboard?.productosBajoMinimo || 0);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!total) return null;
  return (
    <span className="nav-badge" title={`${total} producto(s) bajo mínimo`}>
      {total}
    </span>
  );
}
