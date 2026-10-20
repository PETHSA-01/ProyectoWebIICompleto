// Estructura CFDI 4.0 (factura fiscal mexicana) SIN TIMBRAR.
//
// LIMITE DECLARADO: el timbrado real exige un PAC (Proveedor Autorizado de
// Certificacion) con contrato, CSD y costo por documento. Este modulo genera
// el XML completo y valido en estructura (emisor, receptor, conceptos,
// impuestos, serie/folio) y deja el campo `uuid_fiscal` listo para recibir
// el Timbre Fiscal Digital. NO se simula un timbre falso.
//
// Punto de extension: `timbrarConPac(xml)` (abajo) es donde se conectaria el
// cliente del PAC elegido; hoy lanza un error explicito.

function escaparXml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function dinero(valor) {
  return (Math.round(Number(valor || 0) * 100) / 100).toFixed(2);
}

function fechaCfdi() {
  // Formato del SAT: yyyy-mm-ddTHH:mm:ss (hora local, sin zona).
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return (
    `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}` +
    `T${dos(ahora.getHours())}:${dos(ahora.getMinutes())}:${dos(ahora.getSeconds())}`
  );
}

/** Emisor desde variables de entorno (datos demo si no se configuran). */
export function datosEmisor() {
  return {
    rfc: process.env.CFDI_RFC_EMISOR || 'XAXX010101000',
    nombre: process.env.CFDI_NOMBRE_EMISOR || 'NexoPlay Demo SA de CV',
    regimenFiscal: process.env.CFDI_REGIMEN_EMISOR || '601',
    lugarExpedicion: process.env.CFDI_CP_EMISOR || '45670',
  };
}

/**
 * Construye el XML CFDI 4.0.
 *
 * @param {object} factura fila de facturas (serie, folio, rfc, razon_social, ...)
 * @param {Array}  lineas  [{ descripcion, cantidad, valorUnitario, importe,
 *                            tasa, iva, claveProdServ?, claveUnidad? }]
 * @param {object} emisor  datosEmisor()
 */
export function generarCfdiXml({ factura, lineas, emisor }) {
  const totalIva = lineas.reduce((s, l) => s + Number(l.iva || 0), 0);
  const subTotal = lineas.reduce((s, l) => s + Number(l.importe || 0), 0);
  const total = subTotal + totalIva;

  const conceptos = lineas
    .map((l) => {
      const claveProd = l.claveProdServ || '44111900';
      const claveUnidad = l.claveUnidad || 'H87';
      const importe = dinero(l.importe);
      const tieneIva = Number(l.iva) > 0;
      const tasa = Number(l.tasa || 0.16).toFixed(6);
      return `    <cfdi:Concepto ClaveProdServ="${escaparXml(claveProd)}" Cantidad="${dinero(l.cantidad)}" ClaveUnidad="${escaparXml(claveUnidad)}" Descripcion="${escaparXml(l.descripcion)}" ValorUnitario="${dinero(l.valorUnitario)}" Importe="${importe}" ObjetoImp="${tieneIva ? '02' : '01'}">
${tieneIva ? `      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${importe}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${tasa}" Importe="${dinero(l.iva)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
` : ''}    </cfdi:Concepto>`;
    })
    .join('\n');

  // Resumen de traslados agrupado por tasa (el SAT exige una entrada por
  // cada TasaOCuota distinta; el envio sin IVA no aparece aqui).
  const porTasa = new Map();
  for (const l of lineas) {
    if (Number(l.iva) <= 0) continue;
    const tasa = Number(l.tasa || 0.16);
    const actual = porTasa.get(tasa) || { base: 0, iva: 0 };
    actual.base += Number(l.importe || 0);
    actual.iva += Number(l.iva || 0);
    porTasa.set(tasa, actual);
  }
  const traslados = [...porTasa.entries()]
    .map(
      ([tasa, v]) =>
        `      <cfdi:Traslado Base="${dinero(v.base)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="${tasa.toFixed(6)}" Importe="${dinero(v.iva)}"/>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="${escaparXml(factura.serie)}" Folio="${escaparXml(factura.folio)}" Fecha="${fechaCfdi()}" Moneda="MXN" TipoDeComprobante="I" Exportacion="01" MetodoPago="PUE" FormaPago="03" SubTotal="${dinero(subTotal)}" Total="${dinero(total)}" LugarExpedicion="${escaparXml(emisor.lugarExpedicion)}">
  <cfdi:Emisor Rfc="${escaparXml(emisor.rfc)}" Nombre="${escaparXml(emisor.nombre)}" RegimenFiscal="${escaparXml(emisor.regimenFiscal)}"/>
  <cfdi:Receptor Rfc="${escaparXml(factura.rfc)}" Nombre="${escaparXml(factura.razon_social)}" DomicilioFiscalReceptor="${escaparXml(factura.codigo_postal_fiscal)}" RegimenFiscalReceptor="${escaparXml(factura.regimen_fiscal)}" UsoCFDI="${escaparXml(factura.uso_cfdi)}"/>
  <cfdi:Conceptos>
${conceptos}
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${dinero(totalIva)}">
    <cfdi:Traslados>
${traslados}
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>`;
}

/**
 * Punto de extension del timbrado real. Se conectaria aqui el PAC.
 * No se implementa ni se simula: sin PAC no existe UUID fiscal valido.
 */
export async function timbrarConPac() {
  throw new Error(
    'El timbrado CFDI requiere un PAC con contrato y CSD. ' +
      'La factura se genero sin timbre (uuid_fiscal vacio).'
  );
}

/** Calcula los renglones del CFDI a partir de los detalles del pedido. */
export function lineasDesdePedido(pedido, detalles) {
  const tasa = Number(pedido.tasa_impuesto ?? 0.16);
  const lineas = detalles.map((d) => {
    const importe = Math.round(Number(d.cantidad) * Number(d.precio_unitario) * 100) / 100;
    return {
      descripcion: d.producto_nombre || `Producto #${d.producto_id}`,
      cantidad: Number(d.cantidad),
      valorUnitario: Number(d.precio_unitario),
      importe,
      tasa,
      iva: Math.round(importe * tasa * 100) / 100,
    };
  });

  const envio = Number(pedido.costo_envio || 0);
  if (envio > 0) {
    lineas.push({
      descripcion: 'Servicio de envio',
      cantidad: 1,
      valorUnitario: envio,
      importe: envio,
      tasa: 0,
      iva: 0,
      claveProdServ: '78101803',
      claveUnidad: 'E48',
    });
  }
  return lineas;
}
