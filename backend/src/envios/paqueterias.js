// Adaptador unico de paqueterias.
//
// Contrato:
//   crearGuia({ pedido, paqueteria, paquete, direccion })
//     -> { paqueteria, numeroGuia, urlRastreo, costoEnvio,
//          fechaEntregaEstimada, simulada, nota }
//
// DECISION DE ALCANCE (honesta): las APIs reales de DHL, Estafeta y FedEx
// exigen contrato comercial y credenciales que este proyecto no tiene. Por
// eso:
//   1. Si la paqueteria elegida NO tiene credenciales en .env, se genera una
//      guia SIMULADA con el formato real de folio de esa paqueteria, para
//      demostrar el flujo completo de punta a punta.
//   2. Si hay credencial, el adaptador real queda listo para activarse
//      (la funcion `crearGuiaReal` marca el punto de extension). No se
//      inventan respuestas de una API real.
import crypto from 'node:crypto';

const DIAS_ENTREGA = { DHL: 3, ESTAFETA: 4, FEDEX: 2, SIMULADA: 5 };
const COSTO_BASE = { DHL: 180, ESTAFETA: 150, FEDEX: 210, SIMULADA: 120 };

/** Digitos aleatorios criptograficos (no Math.random). */
function digitos(n) {
  let salida = '';
  while (salida.length < n) {
    salida += String(crypto.randomInt(0, 10));
  }
  return salida.slice(0, n);
}

function folio(paqueteria) {
  switch (paqueteria) {
    case 'DHL':
      return `JD${digitos(12)}`;
    case 'ESTAFETA':
      return `E${digitos(10)}`;
    case 'FEDEX':
      return `${digitos(12)}`;
    default:
      return `SIM${digitos(12)}`;
  }
}

function urlRastreo(paqueteria, numeroGuia) {
  switch (paqueteria) {
    case 'DHL':
      return `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${numeroGuia}`;
    case 'ESTAFETA':
      return `https://www.estafeta.com/Herramientas/Rastreo?waybill=${numeroGuia}`;
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${numeroGuia}`;
    default:
      return null;
  }
}

/** Costo de envio estimado: tarifa base + sobrepeso por kg arriba de 5. */
function costoDeEnvio(paqueteria, pesoKg = 0) {
  const base = COSTO_BASE[paqueteria] ?? COSTO_BASE.SIMULADA;
  const sobrepeso = Math.max(0, Number(pesoKg) - 5) * 15;
  return Math.round((base + sobrepeso) * 100) / 100;
}

function fechaEstimada(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const CLAVES_CREDENCIALES = {
  DHL: 'DHL_API_KEY',
  ESTAFETA: 'ESTAFETA_API_KEY',
  FEDEX: 'FEDEX_API_KEY',
};

/**
 * Punto de extension del adaptador REAL. Cuando exista contrato con la
 * paqueteria y su credencial en .env, esta funcion debe llamar a su API y
 * devolver la guia real con este mismo formato. Hoy no se usa (no hay
 * credenciales), por eso la guia sale marcada como simulada.
 */
async function crearGuiaReal() {
  throw new Error('Adaptador real pendiente de credenciales de la paqueteria.');
}

export async function crearGuia({ pedido, paqueteria, paquete = {}, direccion = null }) {
  const elegida = ['DHL', 'ESTAFETA', 'FEDEX'].includes(paqueteria) ? paqueteria : 'SIMULADA';
  const pesoKg = Number(paquete.pesoKg) || 0;
  const tieneCredencial = Boolean(process.env[CLAVES_CREDENCIALES[elegida]]);

  if (tieneCredencial) {
    // Con credencial, el adaptador real se activa; si falla, se propaga el
    // error para no mentirle al operador con una guia falsa.
    const real = await crearGuiaReal({ pedido, paqueteria: elegida, paquete, direccion });
    return { ...real, paqueteria: elegida, simulada: false, nota: null };
  }

  const numeroGuia = folio(elegida);
  return {
    paqueteria: elegida,
    numeroGuia,
    urlRastreo: urlRastreo(elegida, numeroGuia),
    costoEnvio: costoDeEnvio(elegida, pesoKg),
    fechaEntregaEstimada: fechaEstimada(DIAS_ENTREGA[elegida] ?? 5),
    simulada: true,
    nota:
      `Guia simulada con formato ${elegida}. Para emitir una guia real se ` +
      `requiere contrato y ${CLAVES_CREDENCIALES[elegida] || 'credencial'} en .env.`,
  };
}
