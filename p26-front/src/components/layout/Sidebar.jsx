/**
 * Tema 4 (eventos HTML) + Tema 8 (keys): lista de categorias con su key
 * estable por id; el clic dispara el evento de la maquina de estados.
 */
export function Sidebar({ categorias, cargando, onElegirCategoria }) {
  return (
    <nav className="sidebar" aria-label="Categorias">
      <h2 className="sidebar__titulo">Categorias</h2>
      {cargando ? (
        <ul className="sidebar__lista">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="sidebar__skeleton" />
          ))}
        </ul>
      ) : (
        <ul className="sidebar__lista">
          {categorias.map((categoria) => (
            <li key={categoria.id}>
              <button
                className="sidebar__item"
                onClick={() => onElegirCategoria(categoria.id)}
              >
                {categoria.nombre}
                <span className="sidebar__conteo">{categoria.productos.length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
