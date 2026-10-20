-- migracion-erp.sql — migracion incremental para los 6 modulos del ERP
-- (inventario/almacen, finanzas/facturacion, logistica, CRM/BRM, reportes).
--
-- Solo agrega lo nuevo: NO borra ni toca lo existente, asi se puede correr
-- sobre una base ya inicializada con init.sql. Para instalaciones limpias,
-- init.sql ya incluye estos mismos cambios.
--
-- Ejecutar con:
--   psql -U nexoplay_app -d nexoplay -f db/migracion-erp.sql

BEGIN;

-- =================================================================
-- Modulo 0 — Cimientos: columnas que varios modulos necesitan
-- =================================================================

-- productos: costo de adquisicion, umbral de alerta por producto, SKU y
-- bandera de baja logica (el catalogo solo muestra activos).
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS costo_adquisicion NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_minimo      INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sku               TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS activo            BOOLEAN NOT NULL DEFAULT true;

-- pedidos: desglose fiscal (subtotal/IVA/total) y direccion de envio.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS subtotal          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS impuestos         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasa_impuesto     NUMERIC(5,4)  NOT NULL DEFAULT 0.16,
  ADD COLUMN IF NOT EXISTS costo_envio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS direccion_envio   TEXT,
  ADD COLUMN IF NOT EXISTS ciudad            TEXT,
  ADD COLUMN IF NOT EXISTS estado_geo        TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal     TEXT,
  ADD COLUMN IF NOT EXISTS telefono_contacto TEXT;

-- detalle_pedido: snapshot del costo al momento de vender, para calcular
-- el margen historico (si el costo cambia despues, el pasado no se reescribe).
ALTER TABLE detalle_pedido
  ADD COLUMN IF NOT EXISTS costo_unitario_snapshot NUMERIC(10,2);

-- Backfill: los pedidos existentes quedan como historicos sin IVA registrado
-- (subtotal = total cobrado; NO se recalcula hacia atras: un cobro ya hecho
-- no se reinterpreta).
UPDATE pedidos SET subtotal = total WHERE subtotal IS NULL;

-- =================================================================
-- Modulo 1 — Proveedores, ordenes de compra y libro de inventario
-- =================================================================

CREATE TABLE IF NOT EXISTS proveedores (
  id                  SERIAL PRIMARY KEY,
  nombre              TEXT NOT NULL,
  contacto            TEXT,
  email               TEXT,
  telefono            TEXT,
  marcas_distribuidas TEXT,
  condiciones_pago    TEXT NOT NULL DEFAULT 'CONTADO'
                      CHECK (condiciones_pago IN ('CONTADO', 'CREDITO_30', 'CREDITO_60')),
  dias_credito        INTEGER NOT NULL DEFAULT 0,
  notas               TEXT,
  activo              BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ordenes_compra (
  id           SERIAL PRIMARY KEY,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado       TEXT NOT NULL DEFAULT 'BORRADOR'
               CHECK (estado IN ('BORRADOR', 'RECIBIDA', 'CANCELADA')),
  subtotal     NUMERIC(10,2) NOT NULL DEFAULT 0,
  impuestos    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total        NUMERIC(10,2) NOT NULL DEFAULT 0,
  recibida_en  TIMESTAMPTZ,
  usuario_id   INTEGER REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS detalle_oc (
  id             SERIAL PRIMARY KEY,
  oc_id          INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  producto_id    INTEGER NOT NULL REFERENCES productos(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(10,2) NOT NULL
);

-- Libro de inventario: TODO cambio de stock deja un renglon aqui. Los
-- movimientos se agregan; nunca se sobrescriben ni se borran.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id            SERIAL PRIMARY KEY,
  producto_id   INTEGER NOT NULL REFERENCES productos(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  cantidad      INTEGER NOT NULL,
  origen        TEXT NOT NULL CHECK (origen IN ('OC', 'PEDIDO', 'AJUSTE_MANUAL', 'CANCELACION')),
  referencia_id INTEGER,
  motivo        TEXT,
  usuario_id    INTEGER REFERENCES usuarios(id),
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proveedor demo: distribuidor mayorista de las principales marcas, para que el
-- modulo de compras sea usable sin cargar datos a mano.
INSERT INTO proveedores (nombre, contacto, email, telefono, marcas_distribuidas, condiciones_pago, dias_credito, notas)
SELECT 'Distribuidora Pixel Norte', 'Laura Medina', 'ventas@pixelnorte.example.com', '3312345678',
       'Sony, Nintendo, Microsoft', 'CREDITO_30', 30, 'Proveedor demo del ERP.'
WHERE NOT EXISTS (SELECT 1 FROM proveedores);

-- =================================================================
-- Modulo 2 — Contabilidad y facturacion
-- =================================================================

-- Libro contable (partida doble simplificada): los asientos se agregan y
-- son inmutables; la reversa de una cancelacion es un asiento negativo,
-- nunca un borrado.
CREATE TABLE IF NOT EXISTS movimientos_contables (
  id            SERIAL PRIMARY KEY,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  cuenta        TEXT NOT NULL CHECK (cuenta IN ('CAJA', 'BANCO', 'INVENTARIO', 'COSTO_VENTAS', 'IVA_TRASLADADO', 'IVA_ACREDITABLE')),
  monto         NUMERIC(10,2) NOT NULL,
  concepto      TEXT NOT NULL,
  origen        TEXT NOT NULL CHECK (origen IN ('PEDIDO', 'OC', 'CANCELACION')),
  referencia_id INTEGER,
  usuario_id    INTEGER REFERENCES usuarios(id)
);

-- Facturas: estructura CFDI 4.0 (sin timbrar; el timbrado real requiere un
-- PAC con contrato y CSD — ver src/finanzas/cfdi.js, el adaptador quedo
-- documentado como punto de extension. No se simula un timbre falso).
CREATE TABLE IF NOT EXISTS facturas (
  id                   SERIAL PRIMARY KEY,
  pedido_id            INTEGER NOT NULL UNIQUE REFERENCES pedidos(id),
  serie                TEXT NOT NULL DEFAULT 'A',
  folio                INTEGER NOT NULL,
  rfc                  TEXT NOT NULL,
  razon_social         TEXT NOT NULL,
  regimen_fiscal       TEXT NOT NULL,
  uso_cfdi             TEXT NOT NULL,
  codigo_postal_fiscal TEXT NOT NULL,
  subtotal             NUMERIC(10,2) NOT NULL,
  impuestos            NUMERIC(10,2) NOT NULL,
  total                NUMERIC(10,2) NOT NULL,
  estado               TEXT NOT NULL DEFAULT 'EMITIDA'
                       CHECK (estado IN ('BORRADOR', 'EMITIDA', 'CANCELADA')),
  usuario_id           INTEGER REFERENCES usuarios(id),
  uuid_fiscal          TEXT,
  emitida_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Folio continuo por serie (A0001, A0002, ...).
CREATE SEQUENCE IF NOT EXISTS folio_factura_seq START 1;

-- Columnas agregadas despues de la primera version del ERP (idempotentes para
-- bases que ya corrieron esta migracion antes).
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE envios  ADD COLUMN IF NOT EXISTS simulada BOOLEAN NOT NULL DEFAULT false;

-- =================================================================
-- Modulo 3 — Envios y bitacora de estados
-- =================================================================

CREATE TABLE IF NOT EXISTS envios (
  id                     SERIAL PRIMARY KEY,
  pedido_id              INTEGER NOT NULL UNIQUE REFERENCES pedidos(id),
  paqueteria             TEXT NOT NULL CHECK (paqueteria IN ('DHL', 'ESTAFETA', 'FEDEX', 'SIMULADA')),
  numero_guia            TEXT NOT NULL,
  url_rastreo            TEXT,
  costo_envio            NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_entrega_estimada DATE,
  entregado_en           TIMESTAMPTZ,
  simulada               BOOLEAN NOT NULL DEFAULT false
);

-- Quien y cuando movio cada pedido (el status actual vive en pedidos; esto
-- guarda la trazabilidad para medir tiempos y auditar).
CREATE TABLE IF NOT EXISTS historial_estados_pedido (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo    TEXT NOT NULL,
  comentario      TEXT,
  usuario_id      INTEGER REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- Modulo 4 — Tickets de soporte (el perfil de cliente es agregacion)
-- =================================================================

CREATE TABLE IF NOT EXISTS tickets_soporte (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  pedido_id   INTEGER REFERENCES pedidos(id),
  asunto      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'ABIERTO'
              CHECK (estado IN ('ABIERTO', 'EN_PROCESO', 'CERRADO')),
  prioridad   TEXT NOT NULL DEFAULT 'MEDIA'
              CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en  TIMESTAMPTZ
);

-- =================================================================
-- Permisos y RLS de las tablas nuevas
-- =================================================================

-- GRANTS: web_admin (el rol del panel) necesita CRUD completo en las
-- tablas nuevas. Estas tablas no las toca PostgREST del cliente final,
-- pero el rol del panel las usa de forma uniforme.
GRANT SELECT, INSERT, UPDATE, DELETE ON proveedores, ordenes_compra, detalle_oc,
  movimientos_inventario, movimientos_contables, facturas, envios,
  historial_estados_pedido, tickets_soporte TO web_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_admin;

-- RLS habilitado (tabla protegida por defecto) + politica propia de web_admin
-- sin condicion, para que el panel vea/escriba todo sin que el RLS de
-- "pedidos propios" lo estorbe.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['proveedores', 'ordenes_compra', 'detalle_oc',
    'movimientos_inventario', 'movimientos_contables', 'facturas', 'envios',
    'historial_estados_pedido', 'tickets_soporte']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS admin_total_%I ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY admin_total_%I ON %I FOR ALL TO web_admin USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;

-- Cerrar el pendiente de la capa anterior: en las tablas originales web_admin
-- solo tenia politicas de SELECT. Con esto puede escribir via PostgREST.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pedidos', 'detalle_pedido', 'usuarios', 'productos', 'categorias']
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS admin_total_%I ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY admin_total_%I ON %I FOR ALL TO web_admin USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;

-- Tablas futuras heredan los GRANTS para web_admin sin volver a tocar este
-- archivo (ALTER DEFAULT PRIVILEGES solo aplica a tablas creadas despues,
-- por el mismo rol que ejecuta esto).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_admin;

COMMIT;
