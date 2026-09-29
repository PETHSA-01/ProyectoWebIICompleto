# P2-6 — Backend GraphQL (momento P6) — NexoPlay

Servidor GraphQL en **Node.js + Apollo Server 5**, con base de datos **SQLite
real** (no mock en memoria), que modela el DER de la práctica:

```
Categoria (id, nombre)
   1 ─── N   Producto (id, nombre, precio, imagen, stock)
Usuario (id, nombre, email, password, rol)
   1 ─── N   Pedido (id, fecha, total, status)
Pedido ── N ── Producto   (vía DetallePedido: cantidad, precioUnitario)
```

## 1. Requisitos

- Node.js 18 o superior

## 2. Instalación

```bash
cd p26-back
npm install
cp .env.example .env
```

No necesitas tocar `.env`: los valores por defecto ya funcionan.

> **Nota sobre npm 12+:** este proyecto ya trae un campo `allowScripts` en
> `package.json` que aprueba el script de instalación de `better-sqlite3`
> (compila/descarga su binario nativo). Si con una versión más nueva de npm
> ves un aviso de `install-scripts blocked`, corre `npm rebuild` después del
> `npm install`.

## 3. Base de datos

La base es un archivo **SQLite** (`nexoplay.db`). **No necesitas crearla a
mano**: la primera vez que arrancas el servidor, si el archivo no existe, se
genera automáticamente ejecutando `db.sql` (crea las tablas y las llena con
datos de ejemplo).

Si quieres reiniciarla manualmente en cualquier momento:

```bash
rm nexoplay.db
npm start
```

o pon `RESET_DB=true` en `.env` para que se reinicie en cada arranque
mientras desarrollas.

> `db.sql` también se puede correr por separado con el cliente de SQLite si
> lo prefieres: `sqlite3 nexoplay.db < db.sql`.

## 4. Ejecutar el servidor

```bash
npm start
```

Verás:

```
Base de datos inicializada en .../nexoplay.db
Servidor GraphQL de P2-6 listo en http://localhost:4001/
```

Abre `http://localhost:4001/` en el navegador para usar el Apollo Sandbox
(playground).

## 5. Operaciones disponibles

### Lecturas

```graphql
query {
  categorias {
    id
    nombre
    productos { id nombre precio stock }
  }
}

query {
  categoria(id: "1") { nombre productos { nombre } }
}

query {
  productos(limite: 5, desde: 0) {
    id
    nombre
    precio
    categoria { nombre }
  }
}

query {
  producto(id: "1") { nombre precio categoria { nombre } }
}

query {
  pedidos {
    id
    fecha
    total
    status
    usuario { nombre email }
    detalles {
      cantidad
      precioUnitario
      subtotal
      producto { nombre }
    }
  }
}
```

### Escrituras

```graphql
mutation {
  crearProducto(datos: {
    nombre: "Volante Gamer"
    precio: 79.99
    stock: 15
    categoriaId: "2"
  }) {
    id
    nombre
    categoria { nombre }
  }
}

mutation {
  actualizarProducto(id: "8", datos: {
    nombre: "Volante Gamer Pro"
    precio: 89.99
    stock: 10
    categoriaId: "2"
  }) {
    id
    nombre
    precio
  }
}

mutation {
  eliminarProducto(id: "8")
}

mutation {
  crearPedido(datos: {
    usuarioId: "2"
    detalles: [
      { productoId: "3", cantidad: 1 }
      { productoId: "6", cantidad: 2 }
    ]
  }) {
    id
    total
    status
    usuario { nombre }
    detalles {
      cantidad
      subtotal
      producto { nombre precio }
    }
  }
}
```

## 6. Estructura del proyecto

```
p26-back/
├── db.sql              # esquema + datos semilla (replicable)
├── index.js             # arranque del servidor
├── package.json
├── .env.example
└── src/
    ├── db.js             # conexión SQLite, auto-inicializa desde db.sql
    ├── schema.js         # SDL: types, enums, inputs, Query, Mutation
    └── resolvers.js       # resolvers + resolvers de campo para relaciones
```

## 7. Nota sobre el problema N+1

`Categoria.productos`, `Usuario.pedidos`, `Pedido.detalles` y
`DetallePedido.producto` son **resolvers de campo**: cada uno ejecuta su
propia consulta a la base por cada elemento del padre. Al listar `categorias`
con sus `productos`, por ejemplo, se ejecutan 1 consulta para las categorías
+ 1 consulta por cada categoría para sus productos (el clásico **problema
N+1**). Con el catálogo pequeño de esta práctica el impacto es mínimo, pero
en un catálogo real se resolvería agrupando las consultas por lote — por
ejemplo con **DataLoader** (agrupa los IDs pedidos en un mismo "tick" del
event loop y hace una sola consulta `WHERE categoria_id IN (...)`) o
reescribiendo la consulta inicial con un `JOIN` y agrupando los resultados en
memoria antes de devolverlos.
