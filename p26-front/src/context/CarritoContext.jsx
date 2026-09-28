import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const CarritoContext = createContext(null);

/**
 * Tema 6 (Drilling) resuelto con Tema 11 alternativo: Context API en vez de
 * Zustand. El TopBar y el futuro Checkout leen el mismo carrito sin que
 * cada template intermedio tenga que reenviarlo por props.
 */
export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]); // [{ producto, cantidad }]

  const agregarAlCarrito = useCallback((producto, cantidad) => {
    setItems((prev) => {
      const existente = prev.find((it) => it.producto.id === producto.id);
      if (existente) {
        return prev.map((it) =>
          it.producto.id === producto.id
            ? { ...it, cantidad: it.cantidad + cantidad }
            : it
        );
      }
      return [...prev, { producto, cantidad }];
    });
  }, []);

  const quitarDelCarrito = useCallback((productoId) => {
    setItems((prev) => prev.filter((it) => it.producto.id !== productoId));
  }, []);

  /**
   * Tarea 2.1 / 2.4: actualiza la cantidad de un renglon del carrito.
   * Se clampa entre 1 y el stock disponible del producto: nunca deja la
   * cantidad en 0 (para eso existe quitarDelCarrito) ni por encima de lo
   * que hay en inventario.
   */
  const actualizarCantidad = useCallback((productoId, cantidad) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.producto.id !== productoId) return it;
        const maximo = it.producto.stock ?? cantidad;
        const clamped = Math.min(Math.max(cantidad, 1), maximo);
        return { ...it, cantidad: clamped };
      })
    );
  }, []);

  const vaciarCarrito = useCallback(() => setItems([]), []);

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + it.cantidad, 0),
    [items]
  );

  const totalPrecio = useMemo(
    () => items.reduce((acc, it) => acc + it.cantidad * it.producto.precio, 0),
    [items]
  );

  const value = {
    items,
    agregarAlCarrito,
    quitarDelCarrito,
    actualizarCantidad,
    vaciarCarrito,
    totalItems,
    totalPrecio,
  };

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de un CarritoProvider');
  return ctx;
}
