import { useEffect, useState } from 'react';
import { graphqlRequest, QUERIES } from '../graphql/client';
import { Sidebar } from '../components/layout/Sidebar';
import { Hero } from '../components/layout/Hero';
import { ContextBar } from '../components/layout/ContextBar';
import { ProductoCard } from '../components/ProductoCard';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';

/**
 * Home: estado inicial de la maquina. Carga categorias (para el sidebar) y
 * un listado de productos destacados (para el main) de forma independiente,
 * cada uno con su propio ciclo de carga/error (tema 7: Fetching).
 * Incluye paginacion "cargar mas" (tema opcional 4.3).
 */
const LIMITE_PAGINA = 8;

export function Home({ busqueda, onElegirCategoria, onVerProducto, onIrAlCarrito }) {
  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState(null);

  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState(null);
  const [desde, setDesde] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargarCategorias = () => {
    setCargandoCategorias(true);
    setErrorCategorias(null);
    graphqlRequest(QUERIES.categorias)
      .then((data) => setCategorias(data.categorias))
      .catch((err) => setErrorCategorias(err.message))
      .finally(() => setCargandoCategorias(false));
  };

  const cargarProductos = (reset = false) => {
    const offset = reset ? 0 : desde;
    if (reset) {
      setCargandoProductos(true);
    } else {
      setCargandoMas(true);
    }
    setErrorProductos(null);

    graphqlRequest(QUERIES.productosPaginados, { limite: LIMITE_PAGINA, desde: offset })
      .then((data) => {
        const nuevos = data.productos;
        setProductos((prev) => (reset ? nuevos : [...prev, ...nuevos]));
        setDesde((prev) => (reset ? nuevos.length : prev + nuevos.length));
        setHayMas(nuevos.length === LIMITE_PAGINA);
      })
      .catch((err) => setErrorProductos(err.message))
      .finally(() => {
        setCargandoProductos(false);
        setCargandoMas(false);
      });
  };

  useEffect(() => {
    cargarCategorias();
    cargarProductos(true);
  }, []);

  const productosFiltrados = busqueda
    ? productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : productos;

  return (
    <div className="home-layout">
      <div className="home-layout__sidebar">
        {errorCategorias ? (
          <ErrorMessage mensaje={errorCategorias} onReintentar={cargarCategorias} />
        ) : (
          <Sidebar
            categorias={categorias}
            cargando={cargandoCategorias}
            onElegirCategoria={onElegirCategoria}
          />
        )}
      </div>

      <div className="home-layout__main">
        <Hero />
        <ContextBar onIrAlCarrito={onIrAlCarrito} />

        <section>
          <h2 className="seccion-titulo">
            {busqueda ? `Resultados para "${busqueda}"` : 'Productos destacados'}
          </h2>

          {errorProductos ? (
            <ErrorMessage mensaje={errorProductos} onReintentar={() => cargarProductos(true)} />
          ) : cargandoProductos ? (
            <SkeletonGrid cantidad={LIMITE_PAGINA} />
          ) : productosFiltrados.length === 0 ? (
            <p className="estado-vacio">No encontramos productos con ese nombre.</p>
          ) : (
            <>
              <div className="grid-productos">
                {productosFiltrados.map((producto) => (
                  <ProductoCard
                    key={producto.id}
                    producto={producto}
                    onVerProducto={onVerProducto}
                  />
                ))}
              </div>
              {hayMas && !busqueda && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <button
                    className="boton boton--texto"
                    onClick={() => cargarProductos(false)}
                    disabled={cargandoMas}
                  >
                    {cargandoMas ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
