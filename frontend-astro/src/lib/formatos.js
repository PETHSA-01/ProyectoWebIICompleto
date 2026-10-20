// Utilidades de formato compartidas entre el servidor (Astro) y las islas
// de React. Solo datos de presentación: no dependen de entorno.

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

/**
 * "$8,841.00 MXN" — miles con separador y moneda explícita, igual en la
 * tienda y en el panel.
 */
export function formatoMoneda(valor) {
  return `${formatoMXN.format(Number(valor) || 0)} MXN`;
}

// --- Estados de cobro -> español -----------------------------------------
const COBRO_ES = {
  APROBADO: 'Pagado',
  PENDIENTE: 'Pendiente',
  RECHAZADO: 'Rechazado',
  REEMBOLSADO: 'Reembolsado',
  CANCELADO: 'Cancelado',
};

// --- Estados de envío -> español -----------------------------------------
const ENVIO_ES = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export function estadoCobroEs(estado) {
  return COBRO_ES[estado] || (estado ? estado.toLowerCase() : 'Pendiente');
}

export function estadoEnvioEs(estado) {
  return ENVIO_ES[estado] || (estado || '—');
}

// Tono del badge según el estado (usa los tokens --st-*).
export function tonoCobro(estado) {
  switch (estado) {
    case 'APROBADO':
      return 'ok';
    case 'PENDIENTE':
      return 'pending';
    case 'RECHAZADO':
    case 'CANCELADO':
      return 'bad';
    case 'REEMBOLSADO':
      return 'refund';
    default:
      return 'neutral';
  }
}

export function tonoEnvio(estado) {
  switch (estado) {
    case 'DELIVERED':
      return 'ok';
    case 'PENDING':
      return 'pending';
    case 'CANCELLED':
      return 'bad';
    case 'CONFIRMED':
    case 'SHIPPED':
      return 'refund';
    default:
      return 'neutral';
  }
}

export function nombreRolEs(rol) {
  switch (rol) {
    case 'ADMIN':
      return 'Administrador';
    case 'OPERADOR':
      return 'Operador';
    default:
      return 'Cliente';
  }
}
// --- Fechas ---------------------------------------------------------------
/**
 * Acepta ISO 8601 (lo que devuelve la API), epoch-ms (respuestas viejas) o
 * Date. Devuelve "20 oct 2026" por defecto.
 */
export function formatoFecha(valor, opciones = {}) {
  if (!valor) return '—';
  const fecha =
    valor instanceof Date
      ? valor
      : /^\d{10,}$/.test(String(valor))
        ? new Date(Number(valor))
        : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opciones,
  });
}

export function formatoFechaHora(valor) {
  if (!valor) return '—';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 14.8 -> "14.8%". */
export function formatoPorcentaje(valor, decimales = 1) {
  return `${(Number(valor) || 0).toFixed(decimales)}%`;
}

// --- ERP: estados y catalogos ---------------------------------------------
const OC_ES = {
  BORRADOR: 'Borrador',
  RECIBIDA: 'Recibida',
  CANCELADA: 'Cancelada',
};

export function estadoOCEs(estado) {
  return OC_ES[estado] || estado;
}

export function tonoOC(estado) {
  return estado === 'RECIBIDA' ? 'ok' : estado === 'CANCELADA' ? 'bad' : 'pending';
}

const FACTURA_ES = { BORRADOR: 'Borrador', EMITIDA: 'Emitida', CANCELADA: 'Cancelada' };

export function estadoFacturaEs(estado) {
  return FACTURA_ES[estado] || estado;
}

export function tonoFactura(estado) {
  return estado === 'EMITIDA' ? 'ok' : estado === 'CANCELADA' ? 'bad' : 'pending';
}

const TICKET_ES = { ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', CERRADO: 'Cerrado' };

export function estadoTicketEs(estado) {
  return TICKET_ES[estado] || estado;
}

export function tonoTicket(estado) {
  return estado === 'CERRADO' ? 'ok' : estado === 'EN_PROCESO' ? 'refund' : 'pending';
}

const PRIORIDAD_ES = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };

export function prioridadEs(prioridad) {
  return PRIORIDAD_ES[prioridad] || prioridad;
}

export function tonoPrioridad(prioridad) {
  return prioridad === 'ALTA' ? 'bad' : prioridad === 'MEDIA' ? 'pending' : 'neutral';
}

const PAQUETERIA_ES = {
  DHL: 'DHL',
  ESTAFETA: 'Estafeta',
  FEDEX: 'FedEx',
  SIMULADA: 'Simulada',
};

export function paqueteriaEs(paqueteria) {
  return PAQUETERIA_ES[paqueteria] || paqueteria;
}

const CUENTA_ES = {
  CAJA: 'Caja',
  BANCO: 'Banco',
  INVENTARIO: 'Inventario',
  COSTO_VENTAS: 'Costo de ventas',
  IVA_TRASLADADO: 'IVA trasladado',
  IVA_ACREDITABLE: 'IVA acreditable',
};

export function cuentaContableEs(cuenta) {
  return CUENTA_ES[cuenta] || cuenta;
}

const MOV_INVENTARIO_ES = { ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste' };

export function tipoMovimientoEs(tipo) {
  return MOV_INVENTARIO_ES[tipo] || tipo;
}

export function tonoMovimiento(tipo) {
  return tipo === 'ENTRADA' ? 'ok' : tipo === 'SALIDA' ? 'bad' : 'pending';
}

export function metodoPagoEs(metodo) {
  return (
    { MERCADO_PAGO: 'Mercado Pago', PAYPAL: 'PayPal', OXXO: 'OXXO' }[metodo] ||
    'Sin elegir'
  );
}
