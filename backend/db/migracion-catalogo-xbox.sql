-- migracion-catalogo-xbox.sql
--
-- Deja el catalogo con productos exclusivamente Xbox.
--   * NO borra productos: los que ya tienen ventas/movimientos/OC se
--     referencian desde otras tablas, asi que se dan de baja (activo = false).
--     El catalogo publico solo muestra activos.
--   * Reutiliza los dos productos Xbox que ya existian (Series X y control
--     blanco) para conservar su historial e imagen.
--   * Los productos nuevos dejan su stock inicial en el libro de inventario.
--
-- Ejecutar con:
--   psql -U nexoplay_app -d nexoplay -f db/migracion-catalogo-xbox.sql
--
-- Los precios (MXN) son de referencia: ajustalos a los reales de tu tienda.

BEGIN;

-- --- Categorias: mismo id, nombre orientado a Xbox -----------------------
UPDATE categorias SET nombre = 'Consolas Xbox'    WHERE nombre = 'Consolas';
UPDATE categorias SET nombre = 'Accesorios Xbox'  WHERE nombre = 'Accesorios';
UPDATE categorias SET nombre = 'Juegos Xbox'      WHERE nombre = 'Videojuegos';

-- --- Baja logica de TODO el catalogo anterior ----------------------------
UPDATE productos SET activo = false;

-- --- SKU para los dos productos Xbox que ya existian ---------------------
UPDATE productos SET sku = 'XBX-CON-SX-1TB'
 WHERE sku IS NULL AND nombre ILIKE 'Xbox Series X%';
UPDATE productos SET sku = 'XBX-CTL-WHT'
 WHERE sku IS NULL AND nombre ILIKE 'Control Inal%mbrico Xbox%';

-- --- Alta / actualizacion del catalogo Xbox ------------------------------
-- La imagen NULL conserva la que ya tuviera el producto (COALESCE).
WITH catalogo (sku, nombre, precio, imagen, stock, categoria, costo) AS (
  VALUES
    -- Consolas
    ('XBX-CON-SX-1TB', 'Xbox Series X 1TB Carbon Black',              11499.00, NULL, 10, 'Consolas Xbox',   9200.00),
    ('XBX-CON-SS-512', 'Xbox Series S 512GB Robot White',              6999.00, NULL, 20, 'Consolas Xbox',   5600.00),
    ('XBX-CON-SS-1TB', 'Xbox Series S 1TB Carbon Black',               8499.00, NULL, 12, 'Consolas Xbox',   6800.00),
    -- Accesorios
    ('XBX-CTL-WHT',    'Control Inalámbrico Xbox Robot White',         1199.00, NULL, 45, 'Accesorios Xbox',  900.00),
    ('XBX-CTL-BLK',    'Control Inalámbrico Xbox Carbon Black',        1199.00, NULL, 50, 'Accesorios Xbox',  900.00),
    ('XBX-CTL-ELT2',   'Control Xbox Elite Series 2',                  4299.00, NULL, 12, 'Accesorios Xbox', 3400.00),
    ('XBX-HDS-WL',     'Audífonos Xbox Wireless Headset',              2799.00, NULL, 25, 'Accesorios Xbox', 2200.00),
    ('XBX-MEM-1TB',    'Tarjeta de expansión Seagate 1TB para Xbox Series X|S', 4299.00, NULL, 15, 'Accesorios Xbox', 3500.00),
    ('XBX-PNC-KIT',    'Kit Play & Charge para Xbox',                   899.00, NULL, 30, 'Accesorios Xbox',  650.00),
    -- Juegos
    ('XBX-JGO-FH5',    'Forza Horizon 5 - Xbox Series X|S',            1199.00, NULL, 35, 'Juegos Xbox',      850.00),
    ('XBX-JGO-HALO',   'Halo Infinite - Xbox Series X|S',              1099.00, NULL, 30, 'Juegos Xbox',      780.00),
    ('XBX-JGO-STAR',   'Starfield - Xbox Series X',                    1499.00, NULL, 25, 'Juegos Xbox',     1100.00),
    ('XBX-JGO-GEARS5', 'Gears 5 - Xbox One / Series X|S',               599.00, NULL, 40, 'Juegos Xbox',      420.00)
),
upsert AS (
  INSERT INTO productos
    (sku, nombre, precio, imagen, stock, categoria_id, costo_adquisicion, stock_minimo, activo)
  SELECT c.sku, c.nombre, c.precio, c.imagen, c.stock,
         (SELECT id FROM categorias WHERE nombre = c.categoria),
         c.costo, 5, true
    FROM catalogo c
  ON CONFLICT (sku) DO UPDATE SET
    nombre            = EXCLUDED.nombre,
    precio            = EXCLUDED.precio,
    imagen            = COALESCE(EXCLUDED.imagen, productos.imagen),
    categoria_id      = EXCLUDED.categoria_id,
    costo_adquisicion = EXCLUDED.costo_adquisicion,
    activo            = true            -- el stock existente NO se toca
  RETURNING id, stock, (xmax = 0) AS nuevo
)
-- Libro de inventario: stock inicial solo de los productos recien creados.
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, origen, motivo)
SELECT id, 'ENTRADA', stock, 'AJUSTE_MANUAL', 'Carga inicial del catalogo Xbox'
  FROM upsert
 WHERE nuevo AND stock > 0;

COMMIT;
