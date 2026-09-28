/**
 * Tema 14 (Skeletons): placeholder animado mientras llegan los datos
 * del backend, en vez de un spinner generico.
 */
export function SkeletonGrid({ cantidad = 6 }) {
  return (
    <div className="grid-productos" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-bloque skeleton-imagen" />
          <div className="skeleton-bloque skeleton-linea" style={{ width: '70%' }} />
          <div className="skeleton-bloque skeleton-linea" style={{ width: '40%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetalle() {
  return (
    <div className="skeleton-detalle" aria-busy="true" aria-label="Cargando producto">
      <div className="skeleton-bloque skeleton-imagen-grande" />
      <div className="skeleton-detalle-info">
        <div className="skeleton-bloque skeleton-linea" style={{ width: '60%', height: 28 }} />
        <div className="skeleton-bloque skeleton-linea" style={{ width: '30%' }} />
        <div className="skeleton-bloque skeleton-linea" style={{ width: '90%' }} />
        <div className="skeleton-bloque skeleton-linea" style={{ width: '80%' }} />
      </div>
    </div>
  );
}
