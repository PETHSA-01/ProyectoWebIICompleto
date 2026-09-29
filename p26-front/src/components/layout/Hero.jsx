export function Hero() {
  return (
    <section className="hero">
      <div className="hero__texto">
        <p className="hero__eyebrow">Tienda oficial de accesorios Xbox</p>
        <h1>Todo lo que necesitas para tu Xbox, en un solo lugar</h1>
        <p className="hero__descripcion">
          Consolas, controles, auriculares y videojuegos con stock real y
          entrega rastreable. Elige una categoria para empezar.
        </p>
      </div>
      <div className="hero__simbolo" aria-hidden="true">
        <span className="hero__triangulo hero__triangulo--violeta" />
        <span className="hero__triangulo hero__triangulo--cian" />
      </div>
    </section>
  );
}
