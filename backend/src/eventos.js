// Bus de eventos en memoria para las suscripciones GraphQL.
//
// Con una sola instancia del backend (Render, plan gratuito) un EventEmitter
// basta. Si algun dia hubiera varias instancias, este modulo se cambiaria por
// Redis o LISTEN/NOTIFY de Postgres sin tocar el resto del codigo.
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

const CANAL_STOCK = 'stock';

/** Avisa que el stock (o datos) de un producto cambio. */
export function publicarStock(productoId) {
  bus.emit(CANAL_STOCK, String(productoId));
}

/**
 * Iterador asincrono con los ids de producto que cambian. Si se pasa
 * `soloId`, ignora los demas productos. Se cierra cuando el cliente cancela
 * la suscripcion (return) o se corta el WebSocket.
 */
export async function* escucharStock(soloId = null) {
  const cola = [];
  let despertar = null;
  const alEvento = (id) => {
    if (soloId !== null && String(soloId) !== id) return;
    cola.push(id);
    despertar?.();
  };
  bus.on(CANAL_STOCK, alEvento);
  try {
    while (true) {
      if (cola.length === 0) {
        await new Promise((resolve) => {
          despertar = resolve;
        });
        despertar = null;
      }
      while (cola.length > 0) yield cola.shift();
    }
  } finally {
    bus.off(CANAL_STOCK, alEvento);
  }
}
