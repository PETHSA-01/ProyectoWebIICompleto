-- init.sql — esquema PostgreSQL para el backend del Proyecto Final (NexoPlay)
--
-- Migra el modelo que antes vivía en SQLite (db.sql de la práctica P2-6) a
-- PostgreSQL, y añade lo que exige el Proyecto Final:
--   1) columnas de OAuth2 con Google en `usuarios` (google_id, avatar_url,
--      auth_provider) y `password` ahora nullable (un usuario de Google no
--      tiene contraseña local).
--   2) tres roles de Postgres (web_anon, web_user, web_admin) + Row Level
--      Security, para que PostgREST pueda exponer estas mismas tablas como
--      API REST usando el MISMO JWT que emite el backend de GraphQL — ver
--      la sección "ROLES Y RLS PARA POSTGREST" más abajo y postgrest.conf.
--
-- Ejecutar con:
--   psql -U nexoplay -d nexoplay -f db/init.sql
-- o dejar que docker-compose lo aplique solo (se monta en
-- /docker-entrypoint-initdb.d/ del contenedor de Postgres).

BEGIN;

DROP TABLE IF EXISTS detalle_pedido CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------

CREATE TABLE categorias (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);

CREATE TABLE productos (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  precio        NUMERIC(10, 2) NOT NULL,
  imagen        TEXT,
  stock         INTEGER NOT NULL DEFAULT 0,
  -- Nullable: el panel permite productos sin categoria (el catalogo de la
  -- portada los sigue mostrando; la pagina de categoria, por definicion, no).
  categoria_id  INTEGER REFERENCES categorias(id)
);

-- `password` es NULL para usuarios que solo iniciaron sesión con Google.
-- `google_id` es el "sub" (subject) del token de Google — identificador
-- estable y único de esa cuenta, distinto del email (que en teoría podría
-- cambiar). `auth_provider` documenta explícitamente cómo se autentica
-- cada usuario, en vez de inferirlo de si password es NULL o no.
CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password       TEXT,
  google_id      TEXT UNIQUE,
  avatar_url     TEXT,
  auth_provider  TEXT NOT NULL DEFAULT 'LOCAL' CHECK (auth_provider IN ('LOCAL', 'GOOGLE')),
  rol            TEXT NOT NULL DEFAULT 'CLIENTE' CHECK (rol IN ('ADMIN', 'OPERADOR', 'CLIENTE')),
  CONSTRAINT password_o_google CHECK (password IS NOT NULL OR google_id IS NOT NULL)
);

CREATE TABLE pedidos (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  total           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  -- Capa de cobros (practica "Metodos de cobro + Admin Dashboard")
  metodo_pago     TEXT CHECK (metodo_pago IN ('MERCADO_PAGO', 'PAYPAL', 'OXXO')),
  estado_pago     TEXT NOT NULL DEFAULT 'PENDIENTE'
                  CHECK (estado_pago IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO')),
  referencia_pago TEXT,
  id_pago         TEXT,
  -- Ficha (external_resource_url) de un pago OXXO; permite reabrir la misma
  -- ficha mientras el cobro sigue pendiente.
  ticket_url      TEXT,
  fecha_pago      TIMESTAMPTZ
);

-- Detalle: relación N-N entre pedidos y productos, con la cantidad de cada renglón.
CREATE TABLE detalle_pedido (
  id                SERIAL PRIMARY KEY,
  pedido_id         INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id       INTEGER NOT NULL REFERENCES productos(id),
  cantidad          INTEGER NOT NULL,
  precio_unitario   NUMERIC(10, 2) NOT NULL
);

-- ---------------------------------------------------------------
-- Datos de ejemplo (mismo catálogo que la práctica P2-6)
-- ---------------------------------------------------------------

INSERT INTO categorias (nombre) VALUES
  ('Consolas'),
  ('Accesorios'),
  ('Videojuegos');

INSERT INTO productos (nombre, precio, imagen, stock, categoria_id) VALUES
  ('PlayStation 5 Slim Edición Digital',  8841.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL6fSw7Ue0gEbSaaXSNX3pH3wcGl8XgZ0LQCJJAlv8JmfK1050iqGuMRqu&s=10', 15, 1),
  ('Nintendo Switch OLED 64GB',          6099.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqBFbvrpTVk_lHQVreGG-yON2xp8W1nNEIvI2Wm7PGbg&s=10', 30, 1),
  ('Xbox Series X 1TB Carbon Black',    11499.00, 'https://m.media-amazon.com/images/I/61WV2vIMfFL._AC_UF1000,1000_QL80_.jpg', 10, 1),
  ('Control Inalámbrico DualSense PS5',   1299.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSwuAHC2aYf9bREjgOisVVTcPR7B-Qfw-kBYnFUPNInhA&s', 50, 2),
  ('Control Inalámbrico Xbox Robot White', 1199.00, 'https://m.media-amazon.com/images/I/61bh+T2v7SL._AC_UF1000,1000_QL80_.jpg', 45, 2),
  ('Audífonos Gamer HyperX Cloud II',     1499.00, 'https://m.media-amazon.com/images/I/71ltsViEA8L.jpg', 25, 2),
  ('The Legend of Zelda: Tears of the Kingdom', 999.00, 'https://m.media-amazon.com/images/I/710+L4ulGIL._AC_UF1000,1000_QL80_.jpg', 40, 3),
  ('EA SPORTS FC 24 - PlayStation 5',      699.00, 'https://cdn2.gameplanet.com/wp-content/uploads/2023/09/28194054/014633748697-portada-fc24-ps5-1.jpg', 60, 3);

-- Usuario admin local (para poder entrar sin depender de Google en
-- desarrollo/pruebas); el password es un hash bcrypt real de "admin123"
-- (estas cuentas demo se documentan en el README del backend, y en
-- producción se cambian por unas reales). Tambien se crean las cuentas
-- de demostracion Operador y Cliente para la evaluacion presencial.
INSERT INTO usuarios (nombre, email, password, auth_provider, rol) VALUES
  ('Admin NexoPlay', 'admin@nexoplay.com', '$2b$10$JfloyPsTPjZKUOoBMtQdduAVCF4DHidTKh0oziVkjdisEwMTGXJLq', 'LOCAL', 'ADMIN'),
  ('Operador NexoPlay', 'operador@nexoplay.com', '$2b$10$L.Gv21z/UQoCQ8R9DvjKYO1xn9sODOVBgerl.Sr4zHNDUBjGWQfkK', 'LOCAL', 'OPERADOR'),
  ('Cliente Demo', 'cliente@nexoplay.com', '$2b$10$GlIatUhSnNm0UzNbUK1dB.CvEoKvWuUfg7BnIJQTYujK3mz8c37jK', 'LOCAL', 'CLIENTE');

-- =================================================================
-- Modulos del ERP (espejo de db/migracion-erp.sql para instalaciones
-- limpias; las bases ya creadas aplican la migracion incremental).
-- =================================================================

-- productos: costo de adquisicion, umbral de alerta por producto, SKU y
-- bandera de baja logica (el catalogo solo muestra activos).
ALTER TABLE productos
  ADD COLUMN costo_adquisicion NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN stock_minimo      INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN sku               TEXT UNIQUE,
  ADD COLUMN activo            BOOLEAN NOT NULL DEFAULT true;

-- pedidos: desglose fiscal (subtotal/IVA/total) y direccion de envio.
ALTER TABLE pedidos
  ADD COLUMN subtotal          NUMERIC(10,2),
  ADD COLUMN impuestos         NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN tasa_impuesto     NUMERIC(5,4)  NOT NULL DEFAULT 0.16,
  ADD COLUMN costo_envio       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN direccion_envio   TEXT,
  ADD COLUMN ciudad            TEXT,
  ADD COLUMN estado_geo        TEXT,
  ADD COLUMN codigo_postal     TEXT,
  ADD COLUMN telefono_contacto TEXT;

-- detalle_pedido: snapshot del costo al momento de vender (margen historico).
ALTER TABLE detalle_pedido
  ADD COLUMN costo_unitario_snapshot NUMERIC(10,2);

CREATE TABLE proveedores (
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

CREATE TABLE ordenes_compra (
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

CREATE TABLE detalle_oc (
  id             SERIAL PRIMARY KEY,
  oc_id          INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  producto_id    INTEGER NOT NULL REFERENCES productos(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(10,2) NOT NULL
);

-- Libro de inventario: TODO cambio de stock deja un renglon aqui; los
-- movimientos se agregan y nunca se sobrescriben ni se borran.
CREATE TABLE movimientos_inventario (
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

-- Libro contable (partida doble simplificada): asientos inmutables; la
-- reversa de una cancelacion es un asiento negativo, nunca un borrado.
CREATE TABLE movimientos_contables (
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

-- Facturas: estructura CFDI 4.0 sin timbrar (el timbrado real requiere un
-- PAC con contrato y CSD; ver src/finanzas/cfdi.js).
CREATE TABLE facturas (
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

CREATE SEQUENCE folio_factura_seq START 1;

CREATE TABLE envios (
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

-- Quien y cuando movio cada pedido (trazabilidad; el estado actual sigue
-- viviendo en pedidos.status).
CREATE TABLE historial_estados_pedido (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo    TEXT NOT NULL,
  comentario      TEXT,
  usuario_id      INTEGER REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets_soporte (
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

-- Proveedor demo para que el modulo de compras sea usable sin datos a mano.
INSERT INTO proveedores (nombre, contacto, email, telefono, marcas_distribuidas, condiciones_pago, dias_credito, notas)
VALUES ('Distribuidora Pixel Norte', 'Laura Medina', 'ventas@pixelnorte.example.com', '3312345678',
        'Sony, Nintendo, Microsoft', 'CREDITO_30', 30, 'Proveedor demo del ERP.');

-- Nota: ya NO se inserta aquí un usuario "Juan Perez" con password de
-- ejemplo ni un pedido semilla a su nombre, porque en este proyecto los
-- pedidos solo los puede crear un usuario autenticado (por Google, en la
-- práctica) y el `usuario_id` se toma del JWT, no de un valor fijo — ver
-- resolvers.js, mutation crearPedido.

COMMIT;

-- =================================================================
-- ROLES Y RLS PARA POSTGREST
-- =================================================================
-- PostgREST no tiene su propio sistema de permisos: reutiliza los roles
-- y privilegios de Postgres. El flujo es:
--   1. Un cliente manda su JWT (el MISMO que emite el backend al hacer
--      login con Google) en el header Authorization: Bearer <token>.
--   2. PostgREST verifica la firma con el jwt-secret de postgrest.conf
--      (debe ser idéntico al JWT_SECRET del backend).
--   3. Lee el claim "role" del JWT y ejecuta `SET ROLE <ese valor>` antes
--      de correr la consulta — por eso el backend firma el JWT con un
--      claim "role" en {web_anon, web_user, web_admin} (ver
--      backend/src/auth/jwt.js).
--   4. Postgres aplica los GRANT y las políticas de RLS de ese rol.
--
-- Esto es intencionalmente independiente de GraphQL: aunque el frontend
-- de esta entrega solo usa GraphQL, PostgREST queda disponible como una
-- API REST auto-generada sobre las mismas tablas, protegida con las
-- mismas credenciales.

-- Rol "de aplicación", dueño de la conexión que usa PostgREST para
-- autenticar el JWT y decidir a qué otro rol saltar.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authenticator_pw_dev';
  END IF;
END $$;

-- web_anon: acceso público de solo lectura al catálogo (lo que cualquier
-- visitante sin sesión puede ver: categorías y productos).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END $$;
GRANT web_anon TO authenticator;
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT ON categorias, productos TO web_anon;

-- web_user: un cliente autenticado (login con Google). Puede leer el
-- catálogo, crear sus propios pedidos y ver solo SUS pedidos/detalles —
-- se restringe con RLS, no con GRANT, porque la restricción depende del
-- contenido de la fila (usuario_id), no solo de la tabla.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_user') THEN
    CREATE ROLE web_user NOLOGIN;
  END IF;
END $$;
GRANT web_user TO authenticator;
GRANT USAGE ON SCHEMA public TO web_user;
GRANT SELECT ON categorias, productos TO web_user;
GRANT SELECT, INSERT ON pedidos, detalle_pedido TO web_user;
-- UPDATE a nivel de columnas (no del rol): un cliente puede editar sus datos
-- de perfil, pero nunca su rol (evita escalada CLIENTE -> ADMIN via PATCH).
GRANT UPDATE (nombre, email, password, avatar_url) ON usuarios TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_user;

-- web_admin: el rol del panel administrativo — CRUD completo de
-- productos/categorías y visibilidad total de pedidos y usuarios.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_admin') THEN
    CREATE ROLE web_admin NOLOGIN;
  END IF;
END $$;
GRANT web_admin TO authenticator;
GRANT USAGE ON SCHEMA public TO web_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO web_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_admin;

-- Row Level Security: un web_user solo ve/inserta sus propias filas.
-- current_setting('request.jwt.claims', true) es el mecanismo estándar de
-- PostgREST para exponer el contenido del JWT dentro de Postgres; aquí se
-- lee el claim "sub" (el id de usuario) que el backend firma en el token.
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY pedidos_propios ON pedidos
  FOR SELECT USING (
    usuario_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
  );
CREATE POLICY pedidos_crear_propios ON pedidos
  FOR INSERT WITH CHECK (
    usuario_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
  );

CREATE POLICY detalle_de_pedidos_propios ON detalle_pedido
  FOR SELECT USING (
    pedido_id IN (
      SELECT id FROM pedidos
      WHERE usuario_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
    )
  );
CREATE POLICY detalle_crear_en_pedidos_propios ON detalle_pedido
  FOR INSERT WITH CHECK (
    pedido_id IN (
      SELECT id FROM pedidos
      WHERE usuario_id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
    )
  );

CREATE POLICY usuarios_verse_a_si_mismo ON usuarios
  FOR SELECT USING (
    id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
  );
CREATE POLICY usuarios_editarse_a_si_mismo ON usuarios
  FOR UPDATE USING (
    id = NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::int
  );

-- web_admin se salta el RLS de arriba (ve/edita todo) porque BYPASSRLS
-- solo lo puede otorgar un superusuario; en su lugar, le agregamos
-- políticas propias sin condición.
CREATE POLICY admin_ve_todos_los_pedidos ON pedidos FOR SELECT TO web_admin USING (true);
CREATE POLICY admin_ve_todo_el_detalle ON detalle_pedido FOR SELECT TO web_admin USING (true);
CREATE POLICY admin_ve_todos_los_usuarios ON usuarios FOR SELECT TO web_admin USING (true);

-- Politica FOR ALL de web_admin sobre TODAS las tablas (incluidas las del
-- ERP): el rol del panel puede leer y escribir sin que las politicas de
-- "pedidos propios" lo estorben. Y RLS habilitado en las tablas nuevas
-- (las originales ya lo tenian) para que existan protegidas desde su
-- creacion; las politicas web_anon/web_user no las tocan.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['proveedores', 'ordenes_compra', 'detalle_oc',
    'movimientos_inventario', 'movimientos_contables', 'facturas', 'envios',
    'historial_estados_pedido', 'tickets_soporte']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['pedidos', 'detalle_pedido', 'usuarios', 'productos',
    'categorias', 'proveedores', 'ordenes_compra', 'detalle_oc',
    'movimientos_inventario', 'movimientos_contables', 'facturas', 'envios',
    'historial_estados_pedido', 'tickets_soporte']
  LOOP
    EXECUTE format(
      'CREATE POLICY admin_total_%I ON %I FOR ALL TO web_admin USING (true) WITH CHECK (true)',
      t, t);
  END LOOP;
END $$;

-- Tablas futuras heredan los GRANTS para web_admin sin tocar este archivo.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_admin;
