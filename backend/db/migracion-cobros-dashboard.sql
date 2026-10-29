-- migracion-cobros-dashboard.sql — migracion incremental para la practica
-- "Metodos de cobro + Admin Dashboard".
--
-- Solo agrega lo nuevo: NO borra ni toca lo existente, asi se puede correr
-- sobre una base ya inicializada con init.sql. Para instalaciones limpias,
-- init.sql ya incluye estos mismos cambios.
--
-- Ejecutar con:
--   psql -U nexoplay_app -d nexoplay -f db/migracion-cobros-dashboard.sql

BEGIN;

-- --- Pedidos: campos de cobro ------------------------------------------
-- metodo_pago    : como piensa pagar el cliente (MERCADO_PAGO | PAYPAL).
-- estado_pago    : estado real del cobro, independiente del estado del pedido
--                  (status sigue siendo PENDING/CONFIRMED/...).
-- referencia_pago: id de la preferencia (Mercado Pago) u order id (PayPal).
-- id_pago        : id del pago/tarjeta ya cargado en la pasarela (si aplica).
-- fecha_pago     : cuando se acredito el pago (estado APROBADO).
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS metodo_pago    TEXT
    CHECK (metodo_pago IN ('MERCADO_PAGO', 'PAYPAL')),
  ADD COLUMN IF NOT EXISTS estado_pago    TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado_pago IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO')),
  ADD COLUMN IF NOT EXISTS referencia_pago TEXT,
  ADD COLUMN IF NOT EXISTS id_pago         TEXT,
  ADD COLUMN IF NOT EXISTS fecha_pago      TIMESTAMPTZ;

-- --- Productos: categoria opcional ---------------------------------------
-- El panel permite guardar productos "sin categoria"; en init.sql la columna
-- ya es nullable desde que existe, aqui se relaja el NOT NULL impuesto por la
-- instalacion original. (Tolerante a que ya no tenga la restriccion.)
ALTER TABLE productos ALTER COLUMN categoria_id DROP NOT NULL;

-- --- Usuarios: rol OPERADOR ---------------------------------------------
-- El proyecto contempla Administrador, Operador y Cliente. Se relaja el
-- CHECK existente para admitir el nuevo rol.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('ADMIN', 'OPERADOR', 'CLIENTE'));

-- --- Seguridad: permisos de escritura a nivel de columnas ----------------
-- Un cliente puede editar sus datos de perfil, pero nunca su rol (evita
-- escalada CLIENTE -> ADMIN via un PATCH a /usuarios de PostgREST). Si el
-- GRANT a nivel tabla sigue vigente, se revierte primero.
REVOKE UPDATE ON usuarios FROM web_user;
GRANT UPDATE (nombre, email, password, avatar_url) ON usuarios TO web_user;

-- --- Cuentas de demostracion para la evaluacion presencial --------------
-- Contrasenas (bcrypt, hash de ejemplo — en produccion cambiarlas):
--   Admin    / admin123      (rol ADMIN)
--   Operador / operador123   (rol OPERADOR)
--   Cliente  / cliente123    (rol CLIENTE)
UPDATE usuarios SET password = '$2b$10$JfloyPsTPjZKUOoBMtQdduAVCF4DHidTKh0oziVkjdisEwMTGXJLq'
  WHERE email = 'admin@nexoplay.com';

INSERT INTO usuarios (nombre, email, password, auth_provider, rol) VALUES
  ('Operador NexoPlay', 'operador@nexoplay.com', '$2b$10$L.Gv21z/UQoCQ8R9DvjKYO1xn9sODOVBgerl.Sr4zHNDUBjGWQfkK', 'LOCAL', 'OPERADOR'),
  ('Cliente Demo', 'cliente@nexoplay.com', '$2b$10$GlIatUhSnNm0UzNbUK1dB.CvEoKvWuUfg7BnIJQTYujK3mz8c37jK', 'LOCAL', 'CLIENTE')
ON CONFLICT (email) DO NOTHING;

COMMIT;