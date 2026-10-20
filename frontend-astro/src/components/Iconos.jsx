// Íconos SVG inline de NexoPlay (trazo 1.75, currentColor). Pequeños,
// sin dependencias externas y listos para usarse tanto en islas de React
// como desde las plantillas .astro.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': 'true',
};

export function IconoCarrito({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest} role="img" aria-label={rest['aria-label']}>
      <path d="M6 7h12l1.2 12.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 7z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

export function IconoLogin({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 12h11" />
      <path d="M13 9l3 3-3 3" />
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
    </svg>
  );
}

export function IconoRegistro({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
      <path d="M18 13v6M15 16h6" />
    </svg>
  );
}

export function IconoSalir({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
      <path d="M13 7l5 5-5 5" />
      <path d="M18 12H8" />
    </svg>
  );
}

export function IconoSol({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconoLuna({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function IconoRecibo({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconoPanel({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <rect x="3" y="3" width="8" height="10" rx="1" />
      <rect x="13" y="3" width="8" height="6" rx="1" />
      <rect x="13" y="11" width="8" height="10" rx="1" />
      <rect x="3" y="15" width="8" height="6" rx="1" />
    </svg>
  );
}

export function IconoProducto({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

export function IconoOrdenes({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function IconoTienda({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4-0M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    </svg>
  );
}

export function IconoBuscar({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function IconoMas({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconoEditar({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

export function IconoEliminar({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconoCerrar({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconoUsuario({ size = 20, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 16 0v1" />
    </svg>
  );
}

export function IconoFlecha({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconoCheck({ size = 40, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5 5.5-6" />
    </svg>
  );
}

export function IconoAlerta({ size = 40, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M12 4L2.5 20h19z" />
      <path d="M12 9.5V14" />
      <path d="M12 16.8v.2" />
    </svg>
  );
}

export function IconoReloj({ size = 40, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
// --- ERP ------------------------------------------------------------------
export function IconoInventario({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M3 8l9-5 9 5v10l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v10" />
      <path d="M7.5 5.5l9 5" />
    </svg>
  );
}

export function IconoCompras({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6" />
      <circle cx="9.5" cy="19.5" r="1.2" />
      <circle cx="17.5" cy="19.5" r="1.2" />
    </svg>
  );
}

export function IconoVentas({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h4" />
    </svg>
  );
}

export function IconoFactura({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </svg>
  );
}

export function IconoEnvio({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

export function IconoClientes({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20v-1.2A5.8 5.8 0 0 1 8.8 13h.4a5.8 5.8 0 0 1 5.8 5.8V20" />
      <path d="M16 5.2A3.2 3.2 0 0 1 16 11M18 13.4a5 5 0 0 1 3 4.6V20" />
    </svg>
  );
}

export function IconoProveedores({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M3 21V9l6-3v15M9 21V6l6 3v12M15 21v-8l6 3v5" />
      <path d="M3 21h18M6 12h.01M6 16h.01M12 12h.01M12 16h.01M18 17h.01" />
    </svg>
  );
}

export function IconoReportes({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-5M12 16V7M16 16v-3M20 16V9" />
    </svg>
  );
}

export function IconoDescargar({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

export function IconoMasMenos({ size = 18, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M4 8h6M7 5v6M14 8h6M14 17h6" />
      <path d="M9 17h.01" />
    </svg>
  );
}
