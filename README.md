# Proyecto Web II

> Breve descripción de una o dos líneas: qué hace la aplicación y para quién es.

![Estado](https://img.shields.io/badge/estado-en%20desarrollo-yellow)
![Licencia](https://img.shields.io/badge/licencia-MIT-blue)

## Tabla de contenido

- [Proyecto Web II](#proyecto-web-ii)
  - [Tabla de contenido](#tabla-de-contenido)
  - [Descripción](#descripción)
  - [Características](#características)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Requisitos previos](#requisitos-previos)
  - [Instalación](#instalación)
    - [Variables de entorno](#variables-de-entorno)
  - [Uso](#uso)
  - [Capturas de pantalla](#capturas-de-pantalla)
  - [Autores](#autores)
  - [Licencia](#licencia)

## Descripción

Explica el objetivo del proyecto, el problema que resuelve y el contexto
(por ejemplo, proyecto final del curso Desarrollo Web II).

## Características

- Catálogo de videojuegos y consolas, carrito y checkout con **IVA desglosado**
  (subtotal, IVA, envío y total).
- Pago con Mercado Pago (tarjeta), PayPal y ficha OXXO; el cobro se confirma
  contra la pasarela y el estado de la orden se actualiza en el backend.
- Login local y con Google; sesión en cookie `httpOnly` y roles
  **CLIENTE / OPERADOR / ADMIN**.
- Panel administrativo con dashboard, productos, órdenes, inventario, compras,
  envíos, clientes, proveedores, ventas, facturación y reportes.
- **ERP integrado**:
  - inventario con libro de movimientos inmutable y umbral por producto;
  - órdenes de compra que actualizan stock, costo y contabilidad al recibirse;
  - margen por pedido con costo congelado al momento de la venta;
  - cancelación de pedidos con devolución de stock y asientos de reversa;
  - facturación **CFDI 4.0** con XML descargable (el timbrado requiere un PAC
    real: no se simula un UUID fiscal);
  - guías de envío con adaptador de paquetería (DHL, Estafeta, FedEx) y modo
    simulado claramente marcado cuando no hay credenciales;
  - CRM de clientes, tickets de soporte y reportes de rotación/estado de
    resultados.

## Tecnologías

| Capa | Tecnologías |
|------|-------------|
| Frontend | Astro 5, islas de React 18, Nanostores, CSS con tokens |
| Backend | Node.js, Express 5, Apollo Server (GraphQL), JWT |
| Base de datos | PostgreSQL (PostgREST para la API REST opcional) |
| Integraciones | Mercado Pago, PayPal, Google Identity, CFDI 4.0, paqueterías |

## Estructura del proyecto

```
ProyectoWebIICompleto/
├── backend/          # GraphQL, autenticación, pagos y módulos del ERP
│   ├── db/           # init.sql (instalación limpia) y migracion-erp.sql
│   └── src/
│       ├── inventario/   # libro de inventario
│       ├── contabilidad/ # asientos automáticos
│       ├── finanzas/     # CFDI 4.0
│       ├── envios/       # adaptadores de paqueterías
│       ├── logistica/    # resolvers de envíos
│       ├── crm/          # clientes y tickets
│       └── reportes/     # rotación y estado de resultados
├── frontend-astro/   # Tienda y panel administrativo
│   └── src/
│       ├── pages/admin/  # páginas del panel
│       └── components/   # islas de React
├── reportes/         # documentación y plan del ERP
└── README.md
```

## Requisitos previos

- Node.js >= 20
- PostgreSQL >= 14
- Git

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/PETHSA-01/ProyectoWebIICompleto.git
cd ProyectoWebIICompleto

# 2. Crear la base y aplicar el esquema (incluye los datos demo)
createdb nexoplay
psql "postgres://USUARIO:CONTRASENA@localhost:5432/nexoplay" -f backend/db/init.sql

# 3. Instalar dependencias
cd backend && npm install
cd ../frontend-astro && npm install
```

### Variables de entorno

Copia los archivos de ejemplo y completa los secretos:

```bash
cp backend/.env.example backend/.env
cp frontend-astro/.env.example frontend-astro/.env
```

Como mínimo necesitas:

```env
# backend/.env
DATABASE_URL=postgres://nexoplay_app:nexoplay_dev@localhost:5432/nexoplay
JWT_SECRET=un-secreto-largo-y-aleatorio
PORT=4001

# frontend-astro/.env
GRAPHQL_URL=http://localhost:4001/graphql
SESSION_SECRET=otro-secreto-largo-y-aleatorio
```

Mercado Pago, PayPal, Google y las paqueterías son opcionales para desarrollo:
sin credenciales el sistema funciona en modo demo/simulado y lo indica en la
interfaz. El archivo `backend/.env.example` documenta cada variable.

## Uso

```bash
# Terminal 1: backend GraphQL
cd backend
npm start          # http://localhost:4001/graphql

# Terminal 2: tienda + panel
cd frontend-astro
npm run dev        # http://localhost:4321
```

Usuarios demo creados por `init.sql`:

| Rol | Correo | Contraseña |
|-----|--------|------------|
| ADMIN | admin@nexoplay.com | admin123 |
| OPERADOR | operador@nexoplay.com | operador123 |
| CLIENTE | cliente@nexoplay.com | cliente123 |

El panel está en `http://localhost:4321/admin`. Ventas, facturación, reportes y
la edición de proveedores son exclusivos del rol ADMIN.

## Capturas de pantalla

![Pantalla principal](docs/inicio.png)

## Autores

**PETHSA-01** – [GitHub](https://github.com/PETHSA-01)
**Edel:3** – [GitHub](https://github.com/alexandersaul365-dotcom)


## Licencia

Este proyecto se distribuye bajo la licencia MIT.
