-- db.sql — esquema y datos semilla para el backend de P2-6 (NexoPlay)
-- Compatible con SQLite. Ejecutar con:
--   sqlite3 nexoplay.db < db.sql
-- o dejar que el servidor lo aplique automáticamente al arrancar (ver src/db.js).

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS detalle_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS categorias;

CREATE TABLE categorias (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE
);

CREATE TABLE productos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  precio        REAL NOT NULL,
  imagen        TEXT,
  stock         INTEGER NOT NULL DEFAULT 0,
  categoria_id  INTEGER NOT NULL,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE usuarios (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  email     TEXT NOT NULL UNIQUE,
  password  TEXT NOT NULL,
  rol       TEXT NOT NULL DEFAULT 'CLIENTE' CHECK (rol IN ('ADMIN', 'CLIENTE'))
);

CREATE TABLE pedidos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL,
  fecha       TEXT NOT NULL DEFAULT (datetime('now')),
  total       REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Detalle: relación N-N entre pedidos y productos, con la cantidad de cada renglón.
CREATE TABLE detalle_pedido (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id         INTEGER NOT NULL,
  producto_id       INTEGER NOT NULL,
  cantidad          INTEGER NOT NULL,
  precio_unitario   REAL NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- ---------------------------------------------------------------
-- Datos de ejemplo
-- ---------------------------------------------------------------
-- ---------------------------------------------------------------
-- Datos de ejemplo con productos reales (Precios en MXN - Mercado Libre / Amazon México)
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

INSERT INTO usuarios (nombre, email, password, rol) VALUES
  ('Admin NexoPlay', 'admin@nexoplay.com', 'hashed:admin123', 'ADMIN'),
  ('Juan Perez',      'juan.perez@example.com', 'hashed:juan123', 'CLIENTE');

-- Pedido actualizado: 1 Nintendo Switch OLED ($6,099.00) + 2 Controles DualSense ($1,299.00 c/u) = $8,697.00
INSERT INTO pedidos (usuario_id, fecha, total, status) VALUES
  (2, datetime('now'), 8697.00, 'CONFIRMED');

INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES
  (1, 2, 1, 6099.00),
  (1, 4, 2, 1299.00);