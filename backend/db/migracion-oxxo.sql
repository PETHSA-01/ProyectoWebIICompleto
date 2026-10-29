-- migracion-oxxo.sql — migracion incremental para la practica "OXXO Pay".
--
-- Solo agrega lo nuevo: NO borra ni toca lo existente, asi se puede correr
-- sobre una base ya inicializada con init.sql. Para instalaciones limpias,
-- init.sql ya incluye estos mismos cambios.
--
-- Ejecutar con:
--   psql -U nexoplay_app -d nexoplay -f db/migracion-oxxo.sql

BEGIN;

-- --- Pedidos: metodo de pago OXXO --------------------------------------
-- El CHECK original solo admitia MERCADO_PAGO y PAYPAL. Se relaja para
-- incluir OXXO (pago en efectivo en tienda, generado via Checkout API de
-- Mercado Pago con payment_method_id = 'oxxo').
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_metodo_pago_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_metodo_pago_check
  CHECK (metodo_pago IN ('MERCADO_PAGO', 'PAYPAL', 'OXXO'));

-- ticket_url: la ficha (transaction_details.external_resource_url) que
-- Mercado Pago devuelve al generar un pago OXXO. Se guarda para poder
-- volver a mostrar la MISMA ficha si el cliente retoma un cobro pendiente,
-- en vez de generar un ticket nuevo.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS ticket_url TEXT;

COMMIT;
