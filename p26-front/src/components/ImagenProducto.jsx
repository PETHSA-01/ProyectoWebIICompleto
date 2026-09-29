import { useState } from 'react';

/**
 * Imagen de producto con respaldo: si la URL no existe o falla al cargar
 * (imagen.imagen es null, o el servidor de imagenes no responde), se
 * muestra un icono generico en vez de un icono de imagen rota.
 */
export function ImagenProducto({ src, alt, grande = false }) {
  const [fallo, setFallo] = useState(false);

  if (!src || fallo) {
    return (
      <div
        className={
          grande
            ? 'producto-card__imagen-placeholder producto-card__imagen-placeholder--grande'
            : 'producto-card__imagen-placeholder'
        }
        aria-hidden="true"
      >
        🎮
      </div>
    );
  }

  return <img src={src} alt={alt} onError={() => setFallo(true)} />;
}
