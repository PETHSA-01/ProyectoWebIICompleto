import { useEffect, useState } from 'react';
import { graphqlRequest, QUERIES } from '../graphql/client';
import { ProductoCard } from '../components/ProductoCard';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';

/**
 * DetalleCategoria: un estado mas de la maquina. Recibe el id de la
 * categoria elegida (dato de contexto del flujo) y pide sus productos.
 */
export function DetalleCategoria({ categoriaId, onVerProducto, onVolver }) {
  const [categoria, setCategoria] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    graphqlRequest(QUERIES.categoria, { id: categoriaId })
      .then((data) => setCategoria(data.categoria))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  return (
    <div className="contenedor pagina">
      <button className="boton boton--texto" onClick={onVolver}>
        ← Volver al inicio
      </button>

      {error ? (
        <ErrorMessage mensaje={error} onReintentar={cargar} />
      ) : cargando ? (
        <>
          <div className="skeleton-bloque skeleton-linea" style={{ width: 220, height: 32, margin: '16px 0' }} />
          <SkeletonGrid cantidad={6} />
        </>
      ) : !categoria ? (
        <p className="estado-vacio">No encontramos esta categoria.</p>
      ) : (
        <>
          <h1 className="pagina__titulo">{categoria.nombre}</h1>
          {categoria.productos.length === 0 ? (
            <p className="estado-vacio">Todavia no hay productos en esta categoria.</p>
          ) : (
            <div className="grid-productos">
              {categoria.productos.map((producto) => (
                <ProductoCard
                  key={producto.id}
                  producto={producto}
                  onVerProducto={onVerProducto}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
