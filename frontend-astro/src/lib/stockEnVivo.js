// Suscripcion GraphQL (graphql-ws) al stock de los productos.
//
// Un solo WebSocket compartido por todas las islas de la pagina: graphql-ws
// multiplexa las suscripciones sobre la misma conexion. Va DIRECTO al backend
// (wss://...onrender.com/graphql) porque el proxy /api/graphql de Netlify no
// reenvia WebSockets. El stock es publico, asi que no lleva token.
//
// Si PUBLIC_GRAPHQL_WS_URL no esta definida, no se conecta y la pagina sigue
// funcionando con el stock del renderizado inicial.
import { useEffect, useState } from 'react';
import { createClient } from 'graphql-ws';

const URL_WS = import.meta.env.PUBLIC_GRAPHQL_WS_URL;
let cliente = null;

function obtenerCliente() {
  if (!URL_WS || typeof window === 'undefined') return null;
  cliente ??= createClient({ url: URL_WS, lazy: true, retryAttempts: Infinity });
  return cliente;
}

const QUERY = `subscription Stock($id: ID) {
  stockActualizado(productoId: $id) { id stock }
}`;

/** Devuelve el stock actual del producto y lo actualiza cuando llega un evento. */
export function useStockEnVivo(productoId, stockInicial) {
  const [stock, setStock] = useState(Number(stockInicial) || 0);
  const [enVivo, setEnVivo] = useState(false);

  useEffect(() => {
    const c = obtenerCliente();
    if (!c) return undefined;
    const cancelar = c.subscribe(
      { query: QUERY, variables: { id: String(productoId) } },
      {
        next: ({ data }) => {
          setEnVivo(true);
          if (data?.stockActualizado) setStock(Number(data.stockActualizado.stock));
        },
        error: () => setEnVivo(false),
        complete: () => setEnVivo(false),
      }
    );
    return cancelar;
  }, [productoId]);

  return { stock, enVivo };
}
