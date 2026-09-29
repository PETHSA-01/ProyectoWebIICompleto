import { useReducer, useState, useTransition } from 'react';
import { CarritoProvider, useCarrito } from './context/CarritoContext';
import { TopBar } from './components/layout/TopBar';
import { Footer } from './components/layout/Footer';
import { Home } from './templates/Home';
import { DetalleCategoria } from './templates/DetalleCategoria';
import { DetalleProducto } from './templates/DetalleProducto';
import { Carrito } from './templates/Carrito';
import { Checkout } from './templates/Checkout';

/**
 * La maquina de estados del flujo (seccion 5.2 de la practica).
 * No hay URLs: "pantalla" dice que template se muestra y los eventos
 * (elegirCategoria, verProducto, agregarAlCarrito, ...) son las unicas
 * transiciones validas entre pantallas.
 */
const estadoInicial = {
  pantalla: 'home',
  categoriaId: null,
  productoId: null,
};

function maquina(estado, evento) {
  switch (evento.type) {
    case 'elegirCategoria':
      return { ...estado, pantalla: 'categoria', categoriaId: evento.categoriaId };
    case 'verProducto':
      return { ...estado, pantalla: 'producto', productoId: evento.productoId };
    case 'irAlCarrito':
      return { ...estado, pantalla: 'carrito' };
    case 'agregarAlCarrito':
      return { ...estado, pantalla: 'carrito' };
    case 'finalizarCompra':
      return { ...estado, pantalla: 'checkout' };
    case 'pedidoCreado':
      return { ...estadoInicial };
    case 'volverHome':
      return { ...estadoInicial };
    case 'volverACategoria':
      return { ...estado, pantalla: 'categoria', productoId: null };
    case 'volverAProducto':
      return estado.productoId
        ? { ...estado, pantalla: 'producto' }
        : { ...estadoInicial };
    case 'volverACarrito':
      return { ...estado, pantalla: 'carrito' };
    default:
      return estado;
  }
}

function Flujo() {
  const [estado, dispatch] = useReducer(maquina, estadoInicial);
  const [busqueda, setBusqueda] = useState('');
  const [, startTransition] = useTransition(); // tema 13: transiciones no bloqueantes al cambiar de template
  const { agregarAlCarrito } = useCarrito();

  const ir = (evento) => startTransition(() => dispatch(evento));

  const handlers = {
    onElegirCategoria: (categoriaId) => ir({ type: 'elegirCategoria', categoriaId }),
    onVerProducto: (productoId) => ir({ type: 'verProducto', productoId }),
    onIrAlCarrito: () => ir({ type: 'irAlCarrito' }),
    onVolverHome: () => ir({ type: 'volverHome' }),
    onVolverACategoria: () => ir({ type: 'volverACategoria' }),
    onVolverAProducto: () => ir({ type: 'volverAProducto' }),
    onVolverACarrito: () => ir({ type: 'volverACarrito' }),
    onFinalizarCompra: () => ir({ type: 'finalizarCompra' }),
    onPedidoCreado: () => ir({ type: 'pedidoCreado' }),
    onAgregarAlCarrito: (producto, cantidad) => {
      agregarAlCarrito(producto, cantidad);
      ir({ type: 'agregarAlCarrito' });
    },
  };

  return (
    <div className="app-shell">
      <TopBar
        busqueda={busqueda}
        onCambiarBusqueda={setBusqueda}
        onIrAlCarrito={handlers.onIrAlCarrito}
        onVolverHome={handlers.onVolverHome}
      />

      <main className="app-main">
        {estado.pantalla === 'home' && (
          <Home
            busqueda={busqueda}
            onElegirCategoria={handlers.onElegirCategoria}
            onVerProducto={handlers.onVerProducto}
            onIrAlCarrito={handlers.onIrAlCarrito}
          />
        )}

        {estado.pantalla === 'categoria' && (
          <DetalleCategoria
            categoriaId={estado.categoriaId}
            onVerProducto={handlers.onVerProducto}
            onVolver={handlers.onVolverHome}
          />
        )}

        {estado.pantalla === 'producto' && (
          <DetalleProducto
            productoId={estado.productoId}
            onAgregarAlCarrito={handlers.onAgregarAlCarrito}
            onVolver={handlers.onVolverACategoria}
          />
        )}

        {estado.pantalla === 'carrito' && (
          <Carrito
            onVolver={handlers.onVolverAProducto}
            onFinalizarCompra={handlers.onFinalizarCompra}
          />
        )}

        {estado.pantalla === 'checkout' && (
          <Checkout
            onVolver={handlers.onVolverACarrito}
            onPedidoCreado={handlers.onPedidoCreado}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <CarritoProvider>
      <Flujo />
    </CarritoProvider>
  );
}
