import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $carrito } from '../stores/carrito.js';
import { IconoCarrito } from './Iconos.jsx';

// El carrito vive en localStorage (persistentAtom), así que el servidor
// siempre lo ve vacío. Para no chocar con la hidratación (React #418/#423)
// el contador solo se pinta DESPUÉS de montar la isla.
export default function CarritoResumen() {
  const carrito = useStore($carrito);
  const [listo, setListo] = useState(false);

  useEffect(() => setListo(true), []);

  const totalItems = carrito.reduce((acc, r) => acc + (r.cantidad || 0), 0);

  return (
    <a href="/carrito" className="accion-icono carrito-resumen" aria-label="Carrito">
      <IconoCarrito size={20} />
      {listo && totalItems > 0 && <span className="carrito-resumen__badge">{totalItems}</span>}
      <span className="tooltip">Carrito</span>
      <style>{`
        .carrito-resumen { position: relative; }
        .carrito-resumen__badge {
          position: absolute;
          top: -2px;
          right: -2px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--on-primary);
          font-size: 11px;
          font-weight: 700;
          line-height: 16px;
          text-align: center;
        }
      `}</style>
    </a>
  );
}