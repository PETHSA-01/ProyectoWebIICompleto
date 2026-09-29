import { persistentAtom } from '@nanostores/persistent';

// $carrito guarda una lista de renglones { productoId, nombre, precio, cantidad }.
// Se usa persistentAtom (localStorage) para que el carrito sobreviva a
// recargar la pagina y, sobre todo, para que se comparta entre islas de
// React independientes (el boton "Agregar" en la pagina de producto y el
// icono/resumen del carrito en el encabezado) sin pasar props entre
// componentes que Astro renderiza por separado.
export const $carrito = persistentAtom('nexoplay:carrito', [], {
  encode: JSON.stringify,
  decode: JSON.parse,
});

export function agregarAlCarrito(producto, cantidad = 1) {
  const actual = $carrito.get();
  const existente = actual.find((r) => r.productoId === producto.id);
  if (existente) {
    $carrito.set(
      actual.map((r) =>
        r.productoId === producto.id ? { ...r, cantidad: r.cantidad + cantidad } : r
      )
    );
  } else {
    $carrito.set([
      ...actual,
      { productoId: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad },
    ]);
  }
}

export function quitarDelCarrito(productoId) {
  $carrito.set($carrito.get().filter((r) => r.productoId !== productoId));
}

export function vaciarCarrito() {
  $carrito.set([]);
}
