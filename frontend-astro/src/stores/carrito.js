import { persistentAtom } from '@nanostores/persistent';

// $carrito guarda una lista de renglones { productoId, nombre, precio,
// cantidad, stock }. Se usa persistentAtom (localStorage) para que el carrito
// sobreviva a recargar la pagina y, sobre todo, para que se comparta entre
// islas de React independientes (el boton "Agregar" en la pagina de producto
// y el icono/resumen del carrito en el encabezado) sin pasar props entre
// componentes que Astro renderiza por separado.
//
// "stock" es una FOTOCOPY del stock que habia cuando se agrego el producto:
// permite que la tienda limite la cantidad agregada sin llamar al backend
// por cada click. El valor real y decisivo lo valida el backend en
// crearPedido (con lock de fila), asi que una captura vieja solo sirve para
// una mejor experiencia, no para la seguridad.
export const $carrito = persistentAtom('nexoplay:carrito', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export function agregarAlCarrito(producto, cantidad = 1) {
  const stock = Number(producto.stock);
  const aAgregar = Math.max(1, Math.floor(cantidad) || 1);

  // Sin existencias el boton ni deberia estar habilitado; por si acaso aqui
  // tambien se ignora.
  if (!Number.isFinite(stock) || stock <= 0 || aAgregar <= 0) return;

  const actual = $carrito.get();
  const existente = actual.find((r) => r.productoId === producto.id);
  if (existente) {
    // El tope es lo que quedo de stock EN ESTE NAVEGADOR: si ya habia 8 en
    // el carrito y el stock capturado era 10, un nuevo click de 1 nos deja en
    // 9 (nunca mas alla de lo que existia). El backend re-valida el stock
    // real al confirmar el pedido.
    const tope = Math.max(1, stock);
    const cantidadNueva = Math.min(existente.cantidad + aAgregar, tope);
    $carrito.set(
      actual.map((r) =>
        r.productoId === producto.id
          ? { ...r, cantidad: cantidadNueva, stock }
          : r
      )
    );
  } else {
    $carrito.set([
      ...actual,
      {
        productoId: producto.id,
        nombre: producto.nombre,
        // El precio llega como cadena (NUMERIC de Postgres); el calculo del
        // total lo hace JS con la coercion numerica.
        precio: producto.precio,
        stock,
        cantidad: Math.min(aAgregar, stock),
      },
    ]);
  }
}

export function quitarDelCarrito(productoId) {
  $carrito.set($carrito.get().filter((r) => r.productoId !== productoId));
}

/**
 * Ajusta la cantidad de un renglón existente, limitada entre 1 y el stock
 * capturado al agregarlo. No permite llegar a 0: para eliminar el producto
 * del carrito se usa quitarDelCarrito.
 */
export function cambiarCantidad(productoId, cantidad) {
  const n = Math.max(1, Math.floor(cantidad) || 1);
  $carrito.set(
    $carrito.get().map((r) => {
      if (r.productoId !== productoId) return r;
      const tope = Number(r.stock) > 0 ? Number(r.stock) : n;
      return { ...r, cantidad: Math.min(n, tope) };
    })
  );
}

export function vaciarCarrito() {
  $carrito.set([]);
}

/**
 * Cuenta la cantidad total (para el numero del encabezado) y devuelve si
 * algun renglon del carrito supera su stock capturado (para avisar en el
 * checkout antes de llegar al backend).
 */
export function resumenCarrito() {
  const renglones = $carrito.get();
  const cantidadTotal = renglones.reduce((acc, r) => acc + (r.cantidad || 0), 0);
  const conStockInsuficiente = renglones.some(
    (r) => Number(r.stock) > 0 && (r.cantidad || 0) > Number(r.stock)
  );
  return { cantidadTotal, conStockInsuficiente };
}
