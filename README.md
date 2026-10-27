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

- Registro e inicio de sesión de usuarios
- CRUD de ...
- Diseño responsivo
- (Agrega las funciones reales)

## Tecnologías

| Capa       | Tecnologías                         |
|------------|-------------------------------------|
| Frontend   | HTML, CSS, JavaScript / React ...   |
| Backend    | Node.js, Express / PHP / Java ...   |
| Base datos | MySQL / MongoDB ...                 |

## Estructura del proyecto

```
ProyectoWebIICompleto/
├── backend/      # API y lógica del servidor
├── cliente/      # Interfaz de usuario
└── README.md
```

## Requisitos previos

- Node.js >= 18 (ajusta según tu proyecto)
- Gestor de base de datos instalado
- Git

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/PETHSA-01/ProyectoWebIICompleto.git
cd ProyectoWebIICompleto

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. Instalar dependencias del cliente
cd ../cliente
npm install
```

### Variables de entorno

Crea un archivo `.env` en `backend/`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=nombre_bd
```

## Uso

```bash
# Iniciar el backend
cd backend
npm start

# Iniciar el cliente
cd cliente
npm start
```

La aplicación estará disponible en `http://localhost:3000`.

## Capturas de pantalla

![Pantalla principal](docs/inicio.png)

## Autores

**PETHSA-01** – [GitHub](https://github.com/PETHSA-01)
**Edel:3** – [GitHub](https://github.com/alexandersaul365-dotcom)


## Licencia

Este proyecto se distribuye bajo la licencia MIT.
