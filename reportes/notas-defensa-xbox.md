# Notas de Defensa — Xbox Store

> **Proyecto:** Xbox Accessories E-Commerce API
> **Stack:** Python + FastAPI + SQLAlchemy + MySQL (PyMySQL) + JWT + WebSocket
> **Materia:** Programación Web 2 (PWII)
> **Uso:** repaso guiado por niveles (0 = arranque, 10 = crítica de diseño). Cada pregunta incluye respuesta y **"Dónde verlo"** para que puedas abrir el código y demostrarlo en la defensa.

> ⚠️ **Regla de oro:** nada se afirma sin respaldo. Cada respuesta apunta a un archivo y función reales. Si algo del código cambió, gana el código, no estas notas.

**Rutas de referencia** (relativas a la raíz del proyecto):

```
project/
├── requirements.txt              # deps completas (raíz)
├── backend/
│   ├── requirements.txt          # deps mínimas reales del backend
│   └── app/
│       ├── main.py
│       ├── adapters/
│       │   ├── auth/{jwt_handler.py, dependencies.py, schemas.py}
│       │   └── http/{schemas.py, routers/*.py}
│       ├── application/
│       │   ├── services/auth_service.py
│       │   └── use_cases/*.py
│       ├── domain/
│       │   ├── entities/*.py
│       │   └── ports/*.py
│       ├── infrastructure/
│       │   ├── database/{connection.py, models.py}
│       │   ├── repositories/*.py
│       │   └── faq_engine/keyword_faq_engine.py
│       └── realtime/{connection_manager.py, chat_ws_handler.py}
└── frontend/index.html
```

---

## Nivel 0 — Visión general y arranque

### P1. ¿Qué es el proyecto y qué stack usa?
**Respuesta:** Es la API de un e-commerce de accesorios Xbox. Backend en **FastAPI** (Python), persistencia en **MySQL** vía **SQLAlchemy 2.0 + PyMySQL**, autenticación con **JWT** (`python-jose`), y un **chat en tiempo real por WebSocket** con motor de FAQ por palabras clave. El frontend es un `index.html` que consume la API.
**Dónde verlo:** `project/backend/app/main.py` — instancia `FastAPI(...)`; `project/requirements.txt` — dependencias.
**Pista de repaso:** memoriza la frase "REST + JWT + WebSocket sobre MySQL".

### P2. ¿Cómo se levanta y en qué puertos corre?
**Respuesta:** Backend: `uvicorn app.main:app --reload` desde `project/backend`, escucha en `http://localhost:8000`. Frontend: abrir `project/frontend/index.html` (sirve en `localhost:3000`). El frontend apunta a la API con `CONFIG.API = 'http://localhost:8000'`.
**Dónde verlo:** `project/frontend/index.html:663-665` — `CONFIG.API` y `CONFIG.WS`; `project/backend/app/adapters/http/routers/chat_router.py:19` — URL del WS.
**Pista de repaso:** 8000 = API, 3000 = frontend (y es el único origen permitido en CORS).

### P3. ¿Dónde está la URL de la base de datos y cómo se llama?
**Respuesta:** Está **hardcodeada** en el módulo de conexión: `DATABASE_URL = "mysql+pymysql://root:@localhost:3306/xbox_ecommerce"` (usuario `root`, sin contraseña, BD `xbox_ecommerce`).
**Dónde verlo:** `project/backend/app/infrastructure/database/connection.py` — `DATABASE_URL` / `create_engine`.
**Pista de repaso:** no hay `.env` en el proyecto; la cadena vive en el código (lo cual es un hallazgo de seguridad, ver Nivel 8).

### P4. ¿Qué hace `main.py` al arrancar y qué expone?
**Respuesta:** Crea la app, configura **CORS**, y en el evento `startup` llama a `create_tables()` para crear las tablas. Registra 5 routers (`auth`, `products`, `buyer-profiles`, `orders`, `chat`) y expone un `GET /` de health-check con info de la API y la URL del WebSocket.
**Dónde verlo:** `project/backend/app/main.py` — `@app.on_event("startup")`, `include_router(...)`, `GET /`.
**Pista de repaso:** "startup → create_tables → routers → health".

---

## Nivel 1 — Arquitectura por capas

### P1. ¿Qué capas hay y qué responsabilidad tiene cada una?
**Respuesta:** Arquitectura **hexagonal (puertos y adaptadores)**: `domain` (entidades y reglas puras, sin frameworks), `application` (casos de uso y servicios de orquestación), `adapters` (entrada/salida: routers HTTP, esquemas Pydantic, JWT, dependencias) e `infrastructure` (detalles: conexión MySQL, repositorios concretos, motor de FAQ, modelos ORM).
**Dónde verlo:** estructura de `project/backend/app/` (`domain/`, `application/`, `adapters/`, `infrastructure/`).
**Pista de repaso:** "el dominio no conoce la base de datos; la BD depende del dominio, no al revés".

### P2. ¿Qué son los "puertos" y dónde están?
**Respuesta:** Los puertos son **interfaces abstractas** (clases ABC) que definen *qué* operaciones necesita el dominio, sin decir *cómo*. Viven en `domain/ports/`: `product_repository_port.py`, `order_repository_port.py`, `user_repository_port.py`, `buyer_profile_repository_port.py`, `chat_repository_port.py` y `faq_engine_port.py`.
**Dónde verlo:** `project/backend/app/domain/ports/` — p. ej. `faq_engine_port.py` (`FaqEnginePort.detect(...)`).
**Pista de repaso:** el puerto es el contrato; el adaptador es la implementación.

### P3. ¿Cómo se conecta un router con la aplicación y la infraestructura?
**Respuesta:** Con **inyección de dependencias de FastAPI**. El router declara `get_use_cases(db: Session = Depends(get_db))`, que crea el repositorio concreto (`MySQLProductRepository(db)`) y lo inyecta al caso de uso. Así el router solo habla con el caso de uso.
**Dónde verlo:** `project/backend/app/adapters/http/routers/product_router.py:15-16` — `get_use_cases`; `project/backend/app/infrastructure/database/connection.py` — `get_db`.
**Pista de repaso:** router → `Depends` → use case → repositorio → MySQL.

### P4. ¿Dónde vive la lógica de negocio: routers, use cases o entidades?
**Respuesta:** En la **capa de dominio** (entidades) y en los **casos de uso**. Las entidades validan sus propias reglas (`Product.validate`, `Order.can_be_cancelled`) y los casos de uso orquestan (`OrderUseCases.create_order`). Los routers solo traducen HTTP y las excepciones `ValueError` a `HTTPException`.
**Dónde verlo:** `project/backend/app/domain/entities/product.py` — `validate`; `project/backend/app/application/use_cases/order_use_cases.py:27-65` — `create_order`.
**Pista de repaso:** "router delgado, caso de uso gordo, entidad con reglas".

---

## Nivel 2 — Entidades de dominio

### P1. ¿Qué valida `Product`?
**Respuesta:** `name` ≥ 2 caracteres, `sku` ≥ 3, `price > 0` y `stock ≥ 0`; además expone `has_stock(qty)` (`stock >= qty`) y `reduce_stock(qty)`.
**Dónde verlo:** `project/backend/app/domain/entities/product.py` — `Product.validate`, `has_stock`, `reduce_stock`.
**Pista de repaso:** precio positivo, stock no negativo.

### P2. ¿Qué roles define `User` y cómo se detecta un operador?
**Respuesta:** El enum `UserRole` tiene `ADMIN`, `OPERATOR`, `CLIENT`. `User.es_operator` devuelve `True` si el rol es `ADMIN` **o** `OPERATOR` (un admin también opera); `es_admin` solo `ADMIN`. `es_valido` exige `username ≥ 3`, un `email` con `@` y que exista `hashed_password`.
**Dónde verlo:** `project/backend/app/domain/entities/user.py` — `UserRole`, `es_admin`, `es_operator`, `es_valido`.
**Pista de repaso:** operador ⊇ admin para permisos de operación.

### P3. ¿Cómo se calcula el total de una orden y cuándo puede cancelarse?
**Respuesta:** `OrderItem.subtotal = unit_price * quantity`; `Order.total` es la suma de los subtotales de sus ítems. `Order.can_be_cancelled()` solo permite cancelar en `PENDING` o `CONFIRMED` (ya no si está `SHIPPED`/`DELIVERED`).
**Dónde verlo:** `project/backend/app/domain/entities/order.py` — `OrderItem.subtotal`, `Order.total`, `can_be_cancelled`, `cancel`.
**Pista de repaso:** una orden enviada ya no se cancela.

### P4. ¿Qué modela el dominio de chat?
**Respuesta:** `ChatMessage` (con `conversation_id`, remitente y bandera `is_automated`), `Conversation` (con `status` `OPEN`/`RESOLVED`/`CLOSED`), `MessageSender` (`CLIENT`/`ASSISTANT`/`OPERATOR`) y `FaqEntry` (`keywords`, `answer`, `category`, `is_active`).
**Dónde verlo:** `project/backend/app/domain/entities/chat.py`.
**Pista de repaso:** el FAQ se representa como una entidad con lista de palabras clave.

### P5. ¿Qué valida `BuyerProfile`?
**Respuesta:** `full_name` ≥ 2, `email` con `@`, `phone` ≥ 7 y `address` ≥ 5. No tiene `user_id`: un perfil de comprador es independiente de un usuario autenticado.
**Dónde verlo:** `project/backend/app/domain/entities/buyer_profile.py:19-27` — `validate`.
**Pista de repaso:** perfil de compra ≠ cuenta de usuario (esto reaparece como hallazgo de seguridad).

---

## Nivel 3 — Casos de uso

### P1. Describe `OrderUseCases.create_order` paso a paso.
**Respuesta:** (1) busca el `BuyerProfile` y verifica que exista y esté activo; (2) por cada ítem busca el producto, exige que exista, esté activo y tenga stock suficiente; (3) construye `OrderItem` con nombre y precio actuales del producto y **descuenta el stock**; (4) actualiza cada producto; (5) crea y guarda la `Order`.
**Dónde verlo:** `project/backend/app/application/use_cases/order_use_cases.py:27-65` — `create_order`.
**Pista de repaso:** valida *antes* de descontar stock → evita descontar de más en un ítem inválido.

### P2. Si un ítem no tiene stock suficiente, ¿qué pasa con los ítems anteriores?
**Respuesta:** Nada se descuenta de más porque la validación de **todos** los ítems ocurre durante el mismo bucle *antes* de llamar a `product_repo.update`. Si un ítem falla, lanza `ValueError` y se detiene el bucle; como los `update` (que hacen `commit`) se ejecutan después del bucle, los productos previos **aún no** se habían persistido.
**Dónde verlo:** `project/backend/app/application/use_cases/order_use_cases.py:37-59` — bucle de validación y luego bucle de `update`.
**Pista de repaso:** aunque no hay transacción, el orden "validar todo → luego persistir" reduce el daño.

### P3. ¿Qué hace `cancel_order`?
**Respuesta:** Llama a `order.cancel()` (valida que el estado permita cancelación) y luego **repone el stock** de cada ítem sumando `quantity` al producto. Al final persiste la orden con su nuevo estado `CANCELLED`.
**Dónde verlo:** `project/backend/app/application/use_cases/order_use_cases.py:88-99` — `cancel_order`.
**Pista de repaso:** cancelar = devolver stock + cambiar estado.

### P4. ¿Cómo actualiza `ProductUseCases.update_product` y qué detalle tiene?
**Respuesta:** Recibe `**kwargs` (solo los campos enviados) e itera aplicando `setattr` únicamente si el atributo existe en la entidad y el valor no es `None`. Así un PATCH parcial no borra campos.
**Dónde verlo:** `project/backend/app/application/use_cases/product_use_cases.py:54-60`.
**Pista de repaso:** PATCH = actualización parcial; `None` se ignora.

### P5. ¿Qué hace `SendMessage.execute`?
**Respuesta:** Guarda el mensaje del cliente, consulta el motor de FAQ (`faq_engine.detect`), y responde con la respuesta de la FAQ si hay coincidencia o con `FALLBACK_RESPONSE` si no. En ambos casos la respuesta del bot se marca `is_automated=True` y se guarda. Devuelve también `faq_matched` y `faq_category`.
**Dónde verlo:** `project/backend/app/application/use_cases/chat_use_cases.py:29-74` — `SendMessage`.
**Pista de repaso:** cliente → detect → respuesta (FAQ o fallback).

---

## Nivel 4 — Repositorios y puertos

### P1. ¿Cómo implementa el patrón repositorio?
**Respuesta:** Cada puerto de `domain/ports/` (interfaz) tiene una implementación en `infrastructure/repositories/` (`MySQLProductRepository`, `MySQLOrderRepository`, `MySQLUserRepository`, `MySQLBuyerProfileRepository`). Los casos de uso dependen del **puerto**, no de la clase concreta.
**Dónde verlo:** `project/backend/app/domain/ports/order_repository_port.py` vs `project/backend/app/infrastructure/repositories/mysql_order_repository.py`.
**Pista de repaso:** cambiar de MySQL a memoria no toca el dominio.

### P2. ¿Qué hacen `_to_entity` y `_to_model`?
**Respuesta:** Traducen entre el **modelo ORM** (SQLAlchemy, "model") y la **entidad de dominio** ("entity"). `_to_entity(model)` construye un `Product`/`Order` desde la fila; `_to_model(entity)` hace lo inverso para guardar. Así el dominio nunca ve objetos de SQLAlchemy.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/mysql_product_repository.py:13-39` — `_to_entity`/`_to_model`.
**Pista de repaso:** el mapeo es la frontera entre dominio e infraestructura.

### P3. ¿Cuándo se hace `commit`, `refresh` y `flush`?
**Respuesta:** `save` y `update` terminan con `self.db.commit()` + `self.db.refresh(model)` en los tres repositorios. El caso especial es `MySQLOrderRepository.save`, que además hace `flush` **antes** de crear los ítems, para obtener el `order_model.id` generado y usarlo como `order_id` en cada `OrderItemModel`.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/mysql_order_repository.py:34-55` — `save` (flush en `:41`).
**Pista de repaso:** `flush` = enviar a la BD para obtener el ID; `commit` = confirmar.

### P4. ¿Qué repositorios son en memoria y por qué?
**Respuesta:** Los del **chat**: `InMemoryConversationRepository`, `InMemoryChatMessageRepository`, `InMemoryFaqRepository`, que usan diccionarios en RAM. Se usan para no acoplar el chat a MySQL; su desventaja es que **pierden el estado al reiniciar** el servidor.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/memory_chat_repository.py`.
**Pista de repaso:** el chat es volátil; las FAQ se re-siembran al crear el repo.

---

## Nivel 5 — Modelos y esquema MySQL

### P1. ¿Qué tablas define el modelo ORM y con qué campos clave?
**Respuesta:** Cinco tablas: `products`, `buyer_profiles`, `orders`, `order_items` y `users`. `ProductModel` guarda `sku` (único), `is_active`, `created_at`; `BuyerProfileModel` guarda `email` (único) y `is_active`; `OrderModel` referencia `buyer_profile_id` y tiene `status`; `OrderItemModel` referencia orden y producto, con `product_name`, `unit_price` y `quantity` "congelados".
**Dónde verlo:** `project/backend/app/infrastructure/database/models.py` — `ProductModel`, `BuyerProfileModel`, `OrderModel`, `OrderItemModel`, `UserModel`.
**Pista de repaso:** se guarda el precio al momento de la compra, no solo el `product_id`.

### P2. ¿Qué relaciones y cascadas hay?
**Respuesta:** `ProductModel.order_items` (relación 1-N) y `BuyerProfileModel.orders` (1-N). Las órdenes contienen sus ítems. La relación con `cascade="all, delete-orphan"` permite que al borrar una orden se manejen sus ítems a nivel ORM.
**Dónde verlo:** `project/backend/app/infrastructure/database/models.py` — `relationship(...)` en `ProductModel`/`BuyerProfileModel`/`OrderModel`.
**Pista de repaso:** `Order` es la raíz; `OrderItem` es dependiente.

### P3. ¿Qué campos son únicos y por qué importa?
**Respuesta:** `products.sku` (identificador de producto) y `buyer_profiles.email` son `unique`. Además existe una validación previa a nivel de caso de uso (`RegisterUser` verifica email/username duplicados; `create_product` verifica SKU existente). La BD es la última defensa ante condiciones de carrera.
**Dónde verlo:** `project/backend/app/infrastructure/database/models.py`; `project/backend/app/application/services/auth_service.py`; `product_use_cases.py:25-27`.
**Pista de repaso:** unicidad = negocio (repositorio) + garantía (BD).

### P4. ¿Cómo se "borran" productos, perfiles y usuarios?
**Respuesta:** Con **soft delete**: en lugar de `DELETE`, se pone `is_active = False` (en `MySQLProductRepository.delete`, `MySQLBuyerProfileRepository.delete`, `MySQLUserRepository.deactivate`). Por eso el endpoint responde `204` aunque la fila siga existiendo, y las listas filtran por `is_active`.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/mysql_product_repository.py:88-94`; `mysql_user_repository.py:52-58`.
**Pista de repaso:** "borrar" = desactivar; los datos se conservan.

### P5. ¿Por qué el chat no sobrevive a un reinicio?
**Respuesta:** Porque sus repositorios guardan todo en diccionarios en memoria (`Dict[int, Conversation]`, etc.). Al reiniciar el proceso se pierde todo salvo las FAQ por defecto, que se vuelven a sembrar en `_seed_default_faqs`.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/memory_chat_repository.py:9-17`, `:50-54`.
**Pista de repaso:** RAM = rápido pero efímero.

---

## Nivel 6 — Autenticación JWT y roles

### P1. ¿Cómo se genera un access token y qué contiene?
**Respuesta:** `create_access_token` crea un JWT firmado con HS256 y `SECRET_KEY`. El payload incluye `sub` (ID del usuario, como string), `email`, `role`, `type="access"` y `exp` (30 minutos). El refresh token solo lleva `sub` y `type="refresh"` con 7 días.
**Dónde verlo:** `project/backend/app/adapters/auth/jwt_handler.py` — `create_access_token`, `create_refresh_token`.
**Pista de repaso:** access = 30 min con rol; refresh = 7 días sin rol.

### P2. ¿Cuál es la diferencia entre access y refresh token, y cómo se usan?
**Respuesta:** El access autoriza cada petición. El refresh (`POST /auth/refresh`) sirve para obtener un nuevo par sin volver a pedir credenciales; `decode_refresh_token` valida `type == "refresh"`. `decode_access_token` rechaza tokens que no sean de tipo `access`, evitando usar un refresh como access.
**Dónde verlo:** `project/backend/app/adapters/auth/jwt_handler.py`; `project/backend/app/adapters/http/routers/auth_router.py:53-65` — `refresh_token`.
**Pista de repaso:** cada token declara su `type` y se valida.

### P3. ¿Cómo se autentica una petición protegida?
**Respuesta:** El router usa `Depends(require_auth)`. Internamente `_get_current_user` extrae el token con `HTTPBearer`, lo decodifica, convierte `sub` a `int`, busca el usuario con `find_by_id` y lanza `401` si no existe o está inactivo. Devuelve la entidad `User`.
**Dónde verlo:** `project/backend/app/adapters/auth/dependencies.py` — `bearer_scheme`, `_get_current_user`, `require_auth`.
**Pista de repaso:** decodifica → busca en BD → verifica activo.

### P4. ¿Cómo se distingue auth de permiso (401 vs 403)?
**Respuesta:** `require_auth` lanza **401** (no autenticado/inválido). `require_operator` y `require_admin` lanzan **403** cuando el usuario está autenticado pero su rol no basta. Es la separación correcta: 401 = identidad, 403 = autorización.
**Dónde verlo:** `project/backend/app/adapters/auth/dependencies.py` — `require_auth`, `require_operator`, `require_admin`.
**Pista de repaso:** 401 "no sé quién eres"; 403 "sé quién eres, pero no puedes".

### P5. ¿Dónde vive el `SECRET_KEY` y qué implica?
**Respuesta:** Está **hardcodeado** en `jwt_handler.py` (`"xbox-store-super-secret-key-2024-cambiar-en-produccion"`). Implica que quien lea el repositorio puede **falsificar tokens**. Debería venir de una variable de entorno.
**Dónde verlo:** `project/backend/app/adapters/auth/jwt_handler.py` — `SECRET_KEY`.
**Pista de repaso:** el propio valor dice "cambiar en producción" (¡y no se cambió!).

### P6. ¿Cómo se guarda la contraseña?
**Respuesta:** No se usa bcrypt en el flujo real. `_hash_password` genera un salt aleatorio (`secrets.token_hex(16)`) y almacena `"salt:sha256(salt+password)"`. La verificación (`_verify_password`) recalcula y compara con `hmac.compare_digest` (comparación en tiempo constante). Aunque `passlib`/`bcrypt` están en `requirements.txt`, el servicio no los usa.
**Dónde verlo:** `project/backend/app/application/services/auth_service.py` — `_hash_password`, `_verify_password`.
**Pista de repaso:** "salt + SHA-256 + comparación constante"; bcrypt declarado pero no aplicado.

---

## Nivel 7 — Routers y endpoints

### P1. ¿Qué prefijos y tags usan los routers?
**Respuesta:** `auth_router` → `/auth` "Autenticación"; `product_router` → `/products` "Productos"; `buyer_profile_router` → `/buyer-profiles` "Perfiles de Compra"; `order_router` → `/orders` "Órdenes de Compra"; `chat_router` → `/chat` "Chat en Tiempo Real".
**Dónde verlo:** cabecera de cada archivo en `project/backend/app/adapters/http/routers/`.
**Pista de repaso:** prefijo en plural, tag en español.

### P2. Enumera los endpoints de autenticación y su nivel de acceso.
**Respuesta:** `POST /auth/register` (público, 201), `POST /auth/login` (público), `POST /auth/refresh` (público pero requiere refresh token válido), `GET /auth/me` (`require_auth`), `GET /auth/users` (admin), `GET /auth/users/{id}` (admin), `DELETE /auth/users/{id}` (admin, no puedes desactivarte a ti mismo).
**Dónde verlo:** `project/backend/app/adapters/http/routers/auth_router.py:25-112`.
**Pista de repaso:** gestión de usuarios = solo admin.

### P3. ¿Qué endpoints de productos existen y quién puede escribir?
**Respuesta:** `GET /products/` y `GET /products/{id}` (públicos), `POST /products/` (`require_operator`), `PATCH /products/{id}` (`require_operator`), `PATCH /products/{id}/stock` (`require_operator`), `DELETE /products/{id}` (`require_admin`). **No existe** `/products/upload-image` (ver Nivel 8).
**Dónde verlo:** `project/backend/app/adapters/http/routers/product_router.py:18-84`.
**Pista de repaso:** lectura pública; escribir operador; borrar solo admin.

### P4. ¿Cómo fluyen los estados de una orden por endpoints?
**Respuesta:** `POST /orders/` (crea, `require_auth`), `GET /orders/` (`require_operator`, filtra por `status`/`buyer_id`), `GET /orders/{id}` (`require_auth`), `PATCH /orders/{id}/confirm` (operador), `/ship` (operador), `/deliver` (operador) y `/cancel` (`require_auth`). El flujo es `PENDING → CONFIRMED → SHIPPED → DELIVERED`; cancelar repone stock.
**Dónde verlo:** `project/backend/app/adapters/http/routers/order_router.py:26-115`.
**Pista de repaso:** confirmar/enviar/entregar = operador; cancelar = cualquier autenticado.

### P5. ¿Cómo funcionan los endpoints de perfiles de compra y chat?
**Respuesta:** `POST /buyer-profiles/` (`require_auth`, 201), `GET /buyer-profiles/` (admin), `GET /buyer-profiles/{id}` (`require_auth`), `PATCH /buyer-profiles/{id}` (`require_auth`), `DELETE /buyer-profiles/{id}` (admin). El chat expone `GET /chat/status` y el WebSocket `WS /chat/ws/{client_id}`.
**Dónde verlo:** `project/backend/app/adapters/http/routers/buyer_profile_router.py:19-78`; `project/backend/app/adapters/http/routers/chat_router.py:8-22`.
**Pista de repaso:** perfiles: cualquiera autenticado lee/escribe, solo admin lista/borra.

### P6. ¿Existe el endpoint de subida de imágenes?
**Respuesta:** **No.** El backend no define `/products/upload-image` en ningún router, aunque el frontend lo invoca con `multipart/form-data`. Es un **contrato roto** que produce 404.
**Dónde verlo:** frontend `project/frontend/index.html:2672` (llamada) vs `project/backend/app/adapters/http/routers/product_router.py` (ausente).
**Pista de repaso:** el frontend promete un endpoint que el backend no implementa.

---

## Nivel 8 — Seguridad y hallazgos

### P1. ¿Qué riesgo tiene `RegisterRequest`?
**Respuesta:** Acepta un campo `role` con valor por defecto `CLIENT`, pero **el cliente puede enviar `role: "admin"`** y el caso de uso lo respeta. Es una **escalada de privilegios** en el registro público: cualquiera puede crearse una cuenta admin.
**Dónde verlo:** `project/backend/app/adapters/auth/schemas.py` — `RegisterRequest.role`; `auth_router.py:29` pasa `body.role` a `RegisterUser`.
**Pista de repaso:** el rol nunca debería venir del cliente en un registro público.

### P2. ¿Qué es el IDOR de `buyer_profiles`?
**Respuesta:** Los perfiles de comprador no tienen `user_id` que los ligue a una cuenta, y `GET /buyer-profiles/{id}` solo exige estar autenticado. Cualquier usuario autenticado puede **leer o modificar el perfil de otro** cambiando el `id` en la URL (Insecure Direct Object Reference).
**Dónde verlo:** `buyer_profile_router.py:41-65`; `domain/entities/buyer_profile.py` (sin `user_id`).
**Pista de repaso:** falta control de propiedad por recurso.

### P3. ¿Qué secretos están hardcodeados?
**Respuesta:** `DATABASE_URL` (usuario `root` sin contraseña) y `SECRET_KEY` del JWT. Ambos deberían estar en variables de entorno; al estar en el código, quedan expuestos en el repositorio.
**Dónde verlo:** `connection.py` — `DATABASE_URL`; `jwt_handler.py` — `SECRET_KEY`.
**Pista de repaso:** "root sin password + secreto en el repo = banderas rojas".

### P4. ¿Cómo está configurado CORS y qué implica?
**Respuesta:** Solo permite los orígenes `http://localhost:3000` y `http://127.0.0.1:3000`, con `allow_credentials=True` y métodos/cabeceras `*`. Es correcto para desarrollo local, pero **rompería en cualquier otro dominio** de despliegue.
**Dónde verlo:** `project/backend/app/main.py` — `CORSMiddleware`.
**Pista de repaso:** CORS literal a `localhost:3000` = no listo para producción.

### P5. ¿Qué detalle tiene `expires_in` en la respuesta de login?
**Respuesta:** `TokenResponse.expires_in` está **fijo en 1800** segundos, no se deriva de `ACCESS_TOKEN_EXPIRE_MINUTES`. Si se cambia la expiración real, la respuesta mentiría al cliente.
**Dónde verlo:** `project/backend/app/adapters/auth/schemas.py` — `TokenResponse.expires_in`.
**Pista de repaso:** constante duplicada = futura inconsistencia.

### P6. ¿Por qué no basta SHA-256 + salt para contraseñas?
**Respuesta:** SHA-256 es **rápido**, lo que favorece ataques de fuerza bruta/diccionario con GPUs. Lo recomendable es un algoritmo **deliberadamente lento** con factor de trabajo (bcrypt, que de hecho está en `requirements.txt` pero no se usa). El salt sí está bien hecho (aleatorio por usuario) y la comparación es en tiempo constante.
**Dónde verlo:** `project/backend/app/application/services/auth_service.py` — `_hash_password`.
**Pista de repaso:** salt ✓, tiempo constante ✓, lentitud ✗.

---

## Nivel 9 — Chat en tiempo real

### P1. ¿Cómo funciona el endpoint WebSocket?
**Respuesta:** `WS /chat/ws/{client_id}` delega en `chat_websocket_endpoint`: crea una conversación, registra la conexión en el `ConnectionManager`, envía un saludo y entra en un bucle leyendo texto. Cada mensaje se parsea como JSON; según `type` puede ser `message` (responde con eco + respuesta del bot), `history` (devuelve el historial) u otro (error).
**Dónde verlo:** `project/backend/app/realtime/chat_ws_handler.py:24-104`.
**Pista de repaso:** conectar → saludo → loop (message/history) → disconnect.

### P2. ¿Qué hace `ConnectionManager`?
**Respuesta:** Mantiene un diccionario `active_connections: Dict[str, WebSocket]` (clave = `conversation_id`). Ofrece `connect` (accept + registrar), `disconnect`, `send_message` (envía JSON con `json.dumps(data, default=str)` para serializar fechas), `broadcast` y `get_active_count`.
**Dónde verlo:** `project/backend/app/realtime/connection_manager.py:8-43`.
**Pista de repaso:** una conexión por conversación; `default=str` para `datetime`.

### P3. ¿Cómo decide el motor de FAQ si responde?
**Respuesta:** `KeywordFaqEngine.detect` normaliza el mensaje (minúsculas, quita acentos y puntuación), lo divide en tokens y compara contra las `keywords` normalizadas de cada FAQ, contando coincidencias. Si la mejor puntuación es `>= MATCH_THRESHOLD (=1)`, devuelve esa FAQ; si no, `None` (y el caso de uso usa el fallback).
**Dónde verlo:** `project/backend/app/infrastructure/faq_engine/keyword_faq_engine.py:7,10-51`.
**Pista de repaso:** con 1 palabra clave coincidente ya hay match.

### P4. ¿Qué responde cuando no entiende el mensaje?
**Respuesta:** `SendMessage` usa `FALLBACK_RESPONSE` ("...llámanos al 800-XBOX-HELP"), marcado `is_automated=True`, y en la respuesta del WebSocket `faq_matched` es `false` y `faq_category` es `null`.
**Dónde verlo:** `project/backend/app/application/use_cases/chat_use_cases.py:12-15,54-59,72-73`.
**Pista de repaso:** fallback con teléfono de contacto.

### P5. ¿Por qué `conversation_id` a veces es `str` y a veces `int`?
**Respuesta:** En el WebSocket, `conversation.id` (int) se convierte a `str` para usarlo como clave del `ConnectionManager` (`Dict[str, WebSocket]`). Pero `GetConversationHistory.execute` y `InMemoryChatMessageRepository.find_by_conversation` esperan `int`; por eso `GetConversationHistory` se llama con `conversation.id` (int) y `ChatMessageRepository.save` hace `int(message.conversation_id)`. Es una conversión int↔str distribuida que conviene documentar.
**Dónde verlo:** `chat_ws_handler.py:26,81`; `memory_chat_repository.py:40,46`; `chat_use_cases.py:83`.
**Pista de repaso:** clave del manager = str; lookup del historial = int.

### P6. ¿Qué limitación tiene el chat?
**Respuesta:** Todo su estado (conversaciones, mensajes, FAQ) vive en memoria del proceso: se pierde al reiniciar, no se comparte entre múltiples workers y no hay persistencia. Además no hay autenticación en el WebSocket (cualquiera puede abrir una conexión).
**Dónde verlo:** `memory_chat_repository.py`; `chat_ws_handler.py:24-28`.
**Pista de repaso:** chat sin persistencia ni auth.

---

## Nivel 10 — Diseño crítico y preguntas trampa

### P1. ¿`create_order` es transaccional? ¿Qué riesgo hay?
**Respuesta:** No. Cada `product_repo.update(product)` hace su propio `commit`, y `order_repo.save(order)` hace otro `commit` distinto. Si fallara el guardado de la orden **después** de descontar stock, el stock quedaría descontado sin orden (inconsistencia), porque no hay una única transacción que abarque todo. El diseño "validar todo primero" mitiga, pero no elimina el riesgo.
**Dónde verlo:** `order_use_cases.py:58-65`; `mysql_product_repository.py:84` y `mysql_order_repository.py:53` (los `commit`).
**Pista de repaso:** múltiples `commit` ≠ una transacción.

### P2. ¿Por qué `ship_order` y `deliver_order` son inconsistentes con `confirm_order`?
**Respuesta:** `confirm_order` y `cancel_order` llaman a métodos de la entidad (`order.confirm()`, `order.cancel()`) que aplican las reglas de dominio. En cambio `ship_order`/`deliver_order` **asignan `order.status` directamente**, duplicando la validación a mano en el caso de uso en lugar de delegar en la entidad. Es una inconsistencia de diseño.
**Dónde verlo:** `order_use_cases.py:82-86` vs `:101-115`.
**Pista de repaso:** unas transiciones por entidad, otras por asignación directa.

### P3. Hay una palabra clave que nunca puede coincidir. ¿Cuál?
**Respuesta:** `"cancelar orden"` en la FAQ de cancelaciones. El motor tokeniza el mensaje con `split()`, así que una palabra clave **de dos palabras** nunca iguala un token individual; aun así la FAQ sí matchea por `"cancelar"`. Es código muerto dentro de `keywords`.
**Dónde verlo:** `memory_chat_repository.py:114`; `keyword_faq_engine.py:38`.
**Pista de repaso:** keywords = 1 token; las frases no sirven.

### P4. ¿Por qué hay dos `requirements.txt` y cuál es el real?
**Respuesta:** El de la raíz (`project/requirements.txt`) es descriptivo y **completo** (fastapi, uvicorn, sqlalchemy, pymysql, pydantic, `python-jose`, `passlib[bcrypt]`, bcrypt, websockets, `python-multipart`, `python-dotenv`, httpx). El de `project/backend/requirements.txt` es **mínimo** (solo 7 líneas: fastapi, uvicorn, sqlalchemy, pymysql, pydantic, `python-jose`, websockets) y **no incluye** passlib, bcrypt, python-multipart ni dotenv. Es un riesgo de despliegue: instalar el mínimo rompe funcionalidades (p. ej. `File/UploadFile`).
**Dónde verlo:** `project/requirements.txt` (38 líneas) vs `project/backend/requirements.txt` (7 líneas).
**Pista de repaso:** dos fuentes de verdad para dependencias = problema.

### P5. El frontend sube una imagen con `multipart/form-data`, pero ¿existe el soporte?
**Respuesta:** No. El backend **no** tiene endpoint `upload-image`, y aunque `python-multipart` esté en el `requirements.txt` de la raíz, falta en el del backend. Resultado: el flujo de subida de imagen falla con 404 aunque la librería esté instalada por otro lado.
**Dónde verlo:** `frontend/index.html:2672`; ausencia en `product_router.py`; `backend/requirements.txt`.
**Pista de repaso:** frontend pide algo que el backend no implementa.

### P6. (Síntesis) Si pudieras arreglar **una sola** cosa antes de la defensa, ¿cuál y por qué?
**Respuesta:** El **`role` en `RegisterRequest`**, porque permite crear una cuenta `ADMIN` desde un endpoint público (escalada de privilegios directa y explotable). Alternativas válidas y defendibles: externalizar `SECRET_KEY`/`DATABASE_URL` a variables de entorno, o envolver `create_order` en una sola transacción. Lo que importa es **justificar el riesgo** con el código.
**Dónde verlo:** `adapters/auth/schemas.py` (role); `jwt_handler.py`/`connection.py` (secretos); `order_use_cases.py` (transacción).
**Pista de repaso:** prioriza por impacto + explotabilidad, no por estética.

---

# Sección Especial — Pasarela de Pago

> **Aviso verificado:** este proyecto **NO integra una pasarela de pago real**. El checkout termina en "Confirmar Orden" y crea la orden directamente, sin cobro. Los niveles siguientes documentan con honestidad *qué existe*, *qué falta* y *cómo se integraría* una pasarela, para que puedas defender el tema sin inventar código que no está.

## Nivel 0 — Concepto y estado actual

### P1. ¿Qué es una pasarela de pago?
**Respuesta:** Un servicio intermediario (Stripe, PayPal, MercadoPago, Conekta…) que **autoriza y captura cobros** sin que el comercio maneje datos de tarjeta. El cliente es redirigido o usa un SDK/token; la pasarela valida con el banco y responde un resultado (aprobado/rechazado). Ventaja clave: el comercio delega la seguridad PCI-DSS.
**Dónde verlo (concepto):** no hay código; se apoya en la integración típica `frontend → SDK/tokenización → pasarela → webhook → backend`.
**Pista de repaso:** la pasarela cobra; el comercio nunca ve el número completo de la tarjeta.

### P2. ¿El proyecto Xbox integra una pasarela?
**Respuesta:** **No.** No existe router de pagos, ni SDK, ni clave de pasarela, ni tabla de pagos. El único rastro de "pago" es **texto de FAQ** y etiquetas de UI ("Total a Pagar"). Lo confirmé buscando en todo el backend: solo aparecen coincidencias en el FAQ del chat.
**Dónde verlo:** `project/backend/app/adapters/http/routers/` (no hay `payment_router.py`); único "pago" en `project/backend/app/infrastructure/repositories/memory_chat_repository.py:68-79` (FAQ categoría `pagos`).
**Pista de repaso:** "hay mención de pagos en el chat, pero cero procesamiento".

### P3. ¿Dónde termina hoy el flujo de compra?
**Respuesta:** En el paso 3 del checkout ("Confirmar"), el botón envía `POST /orders/` con `buyer_profile_id` + `items`, y al recibir la orden muestra "¡Orden Confirmada!". No hay pantalla de pago ni formulario de tarjeta. La orden nace en estado `PENDING` sin que se haya cobrado nada.
**Dónde verlo:** `project/frontend/index.html:1651-1668` — `confirm-order-btn` handler; `project/backend/app/adapters/http/routers/order_router.py:26-37`; `order_use_cases.py:61-65`.
**Pista de repaso:** "checkout sin cobro: la orden es la única salida".

---

## Nivel 1 — Arquitectura: dónde encajaría la pasarela

### P1. En esta arquitectura hexagonal, ¿dónde entraría una pasarela?
**Respuesta:** Como un **puerto** en `domain/ports/` (p. ej. `payment_gateway_port.py` con `authorize(amount, token)` / `capture(id)`) y su **adaptador** de infraestructura (`infrastructure/payments/stripe_gateway.py`). Así el dominio no depende del proveedor y se puede intercambiar Stripe por PayPal sin tocar casos de uso.
**Dónde verlo:** patrón ya usado en `project/backend/app/domain/ports/faq_engine_port.py` + `infrastructure/faq_engine/keyword_faq_engine.py` (mismo esquema puerto/adaptador).
**Pista de repaso:** pasarela = un puerto más, como el motor de FAQ.

### P2. ¿Qué casos de uso cambiarían?
**Respuesta:** Se añadiría un caso de uso de pago (p. ej. `PayOrderUseCase`) y `OrderUseCases.create_order` se ajustaría para **no apartar stock definitivamente hasta confirmar el cobro** (o crear la orden en un estado "pago pendiente"). El router de órdenes obtendría un nuevo endpoint de pago.
**Dónde verlo:** `project/backend/app/application/use_cases/order_use_cases.py:27-65` (`create_order` actual, sin pago).
**Pista de repaso:** el cobro es una orquestación nueva entre orden y pasarela.

---

## Nivel 2 — Modelo de dominio

### P1. ¿Existe una entidad `Payment`?
**Respuesta:** **No.** El dominio solo modela `Order` y `OrderItem` (más `Product`, `User`, `BuyerProfile`, chat). No hay entidad ni enum de estado de pago.
**Dónde verlo:** `project/backend/app/domain/entities/` (no existe `payment.py`); `order.py` solo define `OrderStatus`.
**Pista de repaso:** hoy "pago" no es una cosa que el dominio conozca.

### P2. ¿Qué estados tendría un pago y cómo se relacionaría con `OrderStatus`?
**Respuesta:** Un pago suele tener `PENDING/AUTHORIZED/PAID/FAILED/REFUNDED`. Se relacionaría 1-N o 1-1 con la orden: la orden no debería pasar a `CONFIRMED` hasta que el pago esté `PAID`. Los estados actuales (`PENDING→CONFIRMED→SHIPPED→DELIVERED`, `CANCELLED`) describen **logística**, no cobro.
**Dónde verlo:** `project/backend/app/domain/entities/order.py` — `OrderStatus`, `can_be_cancelled`; `order_use_cases.py:82-115` (transiciones).
**Pista de repaso:** "estado de orden ≠ estado de pago".

---

## Nivel 3 — Casos de uso y flujo de cobro

### P1. Describe el flujo actual de creación de orden.
**Respuesta:** `create_order` valida perfil y stock, descuenta stock, construye ítems y guarda la orden. **En ningún punto se pide ni verifica un cobro.** Cualquier orden creada queda "pagada" a ojos del negocio.
**Dónde verlo:** `project/backend/app/application/use_cases/order_use_cases.py:27-65`.
**Pista de repaso:** descuenta stock y crea orden; no cobra.

### P2. ¿Se crea la orden antes o después de cobrar? ¿Qué patrón conviene?
**Respuesta:** El patrón recomendado es **autorizar (authorize) → crear orden → capturar (capture)** o bien crear la orden en `PENDING` y capturar al confirmar el pago; si falla, se libera el stock. El código actual **no implementa ninguno**: crea la orden y descuenta stock de inmediato sin autorización previa.
**Dónde verlo:** `order_use_cases.py:55-65` (descuento + save sin paso de pago).
**Pista de repaso:** authorize/capture evita cobrar y no entregar (o entregar y no cobrar).

---

## Nivel 4 — Persistencia

### P1. ¿Dónde se guardaría el estado del pago?
**Respuesta:** En una tabla nueva (p. ej. `payments`) con su repositorio y puerto, igual que `orders`/`order_items`. Hoy **no existe**: los repositorios son `MySQLProduct/Order/User/BuyerProfile` y los de chat en memoria.
**Dónde verlo:** `project/backend/app/infrastructure/repositories/` (no hay repositorio de pagos); `project/backend/app/infrastructure/database/models.py` (5 tablas, ninguna de pagos).
**Pista de repaso:** sin tabla de pagos no hay trazabilidad de cobros.

---

## Nivel 5 — Modelo de datos

### P1. ¿Qué campos tendría una tabla de pagos?
**Respuesta:** `id`, `order_id` (FK), `provider` (`stripe`/`paypal`), `provider_payment_id`, `amount`, `currency`, `status`, `idempotency_key`, `created_at`. **Nunca** se guardan número de tarjeta ni CVV (los tokeniza la pasarela).
**Dónde verlo (referencia del estilo de modelo):** `project/backend/app/infrastructure/database/models.py` — `OrderModel` (así se definiría `PaymentModel`).
**Pista de repaso:** guarda IDs de la pasarela y montos, jamás datos sensibles de tarjeta.

### P2. ¿Hay una inconsistencia entre el total mostrado y el total guardado?
**Respuesta:** **Sí.** El frontend muestra el total con **IVA 16%** (`cartTotal() * 1.16`), pero el backend calcula `Order.total` como la suma de `unit_price * quantity` **sin IVA**. La orden persistida no incluye el impuesto que el usuario vio, y no hay validación de importes en el servidor.
**Dónde verlo:** `project/frontend/index.html:1506,1541,1545` (IVA en pantalla) vs `project/backend/app/domain/entities/order.py` (`Order.total`) y `order_use_cases.py:49-54`.
**Pista de repaso:** el precio con IVA vive solo en el cliente; el backend no lo conoce.

---

## Nivel 6 — Seguridad y claves del proveedor

### P1. ¿Cómo debería manejarse la clave secreta de la pasarela?
**Respuesta:** En **variables de entorno**, nunca en el repositorio ni en el frontend. El proyecto ya tiene el antipatrón de secretos hardcodeados (igual que `SECRET_KEY`), así que la pasarela debe externalizarse desde el inicio. La clave **secreta** jamás llega al navegador; solo la **pública** se usa en el frontend.
**Dónde verlo:** `project/backend/app/adapters/auth/jwt_handler.py` — `SECRET_KEY` (patrón a NO repetir).
**Pista de repaso:** secret key = servidor; publishable key = navegador.

### P2. ¿Qué prohíbe PCI-DSS?
**Respuesta:** Almacenar el número completo de tarjeta (PAN) o el CVV en tus servidores. La forma correcta es **tokenizar** en el cliente con el SDK del proveedor y enviar al backend solo el token. Hoy no se maneja ningún dato de ese tipo (porque no hay pasarela), así que no hay riesgo actual de tarjetas.
**Dónde verlo:** no hay formularios de tarjeta en el checkout (`index.html:1434-1682` solo pide perfil de envío).
**Pista de repaso:** "token sí, PAN no".

---

## Nivel 7 — Endpoints e integración

### P1. ¿Qué endpoints de pago existen hoy?
**Respuesta:** **Ninguno.** El router de órdenes solo expone crear/leer/confirmar/enviar/entregar/cancelar. No hay `POST /orders/{id}/pay` ni webhook de pagos.
**Dónde verlo:** `project/backend/app/adapters/http/routers/order_router.py:26-115` (no hay ruta de pago).
**Pista de repaso:** cero endpoints de cobro.

### P2. ¿Cómo se integraría (endpoints y webhook)?
**Respuesta:** Típicamente: `POST /orders/{id}/payment-intent` (crea intento), `POST /webhooks/payments` (la pasarela notifica el resultado) y `GET /orders/{id}` incluye el estado del pago. El webhook debe **verificar la firma** y ser **idempotente**.
**Dónde verlo (estilo del router):** `project/backend/app/adapters/http/routers/order_router.py` (patrón para añadir la ruta); `chat_router.py:8-22` (otro ejemplo de router con WebSocket/REST).
**Pista de repaso:** intento + webhook firmado + estado consultable.

---

## Nivel 8 — Seguridad y hallazgos

### P1. ¿Qué riesgo implica crear órdenes sin cobro?
**Respuesta:** `POST /orders/` solo exige `require_auth`. **Cualquier usuario autenticado puede generar órdenes ilimitadas** y descuenta stock real, sin pagar ni autorizar nada. Añadir pasarela debe ir acompañado de la regla "no confirmar orden sin pago `PAID`".
**Dónde verlo:** `project/backend/app/adapters/http/routers/order_router.py:26-37` (`require_auth`); `order_use_cases.py:55-65` (descuenta stock y guarda).
**Pista de repaso:** orden sin cobro = stock comprometido gratis.

### P2. ¿Qué cuidados exige un webhook de pagos?
**Respuesta:** Validar la **firma** del proveedor, usar **idempotency keys** (no aplicar el mismo evento dos veces), responder rápido (y procesar asíncrono) y confiar solo en el **re-fetch del estado** desde la API de la pasarela, nunca en datos del payload sin verificar. Nada de esto existe hoy (no hay webhook).
**Dónde verlo:** ausencia de webhook en `order_router.py`; el manejo de firma/tokens se apoya en el patrón de `jwt_handler.py` (validar el token recibido).
**Pista de repaso:** firma + idempotencia + re-fetch.

---

## Nivel 9 — Notificación del resultado (tiempo real)

### P1. ¿Cómo avisar al cliente del resultado del pago?
**Respuesta:** Reutilizando el canal WebSocket que ya existe. El `ConnectionManager` podría hacer `broadcast` del cambio de estado a la orden/conversación del cliente; alternativa más simple: **polling** con `GET /orders/{id}` tras confirmar.
**Dónde verlo:** `project/backend/app/realtime/connection_manager.py:27-37` — `broadcast`; `project/backend/app/adapters/http/routers/order_router.py:55-65` — `GET /orders/{id}` (para polling).
**Pista de repaso:** el broadcast ya está disponible; hoy el chat no lo usa para pagos.

---

## Nivel 10 — Diseño crítico

### P1. ¿Cómo evitar el doble cobro?
**Respuesta:** Con **idempotency keys** en cada intento de pago y verificando el estado del intento antes de crear otro. El proyecto no tiene pagos, así que no hay prevención; y ya arrastra el patrón de **múltiples `commit`** sin transacción única en `create_order`, que agravaría la consistencia al añadir cobro.
**Dónde verlo:** `order_use_cases.py:58-65`; `mysql_product_repository.py:84` y `mysql_order_repository.py:53` (los `commit` separados).
**Pista de repaso:** sin idempotencia, un reintento cobra dos veces.

### P2. ¿Orden y pago son consistentes entre sí?
**Respuesta:** Hoy no aplica (no hay pago), pero al integrarlo el riesgo es clásico: si se cobra y falla el guardado de la orden (o al revés), queda un estado inconsistente. Se necesita una **saga/transacción** que enlace cobro y orden, con compensación (reembolso o liberación de stock).
**Dónde verlo:** `order_use_cases.py:27-65` (descuento de stock + guardado, sin transacción envolvente).
**Pista de repaso:** cobra-y-guarda debe ser atómico o compensable.

### P3. (Síntesis) Si integraras una pasarela, ¿cuál es la prioridad número uno?
**Respuesta:** **No permitir confirmar/entregar una orden sin un pago verificado (`PAID`) desde el webhook firmado de la pasarela.** Antes que la UI bonita o el SDK, primero la regla de negocio: el estado de la orden se deriva del estado del pago. Se implementaría como un puerto `PaymentGatewayPort` + adaptador, un webhook validado e idempotente, y un cambio en `OrderUseCases`.
**Dónde verlo (punto de enganche):** `order_use_cases.py:82-115` (transiciones que hoy no miran el pago); `domain/ports/` (dónde iría el puerto).
**Pista de repaso:** "sin pago verificado, no hay orden confirmada".

---

## Anexo — Chequeo rápido de "dónde verlo"

| Tema | Archivo |
|------|---------|
| App, CORS, startup, routers | `backend/app/main.py` |
| Conexión, `DATABASE_URL`, `get_db`, `create_tables` | `backend/app/infrastructure/database/connection.py` |
| Tablas, relaciones, unicidad | `backend/app/infrastructure/database/models.py` |
| JWT access/refresh, `SECRET_KEY` | `backend/app/adapters/auth/jwt_handler.py` |
| `require_auth/operator/admin` | `backend/app/adapters/auth/dependencies.py` |
| `RegisterRequest.role`, `TokenResponse` | `backend/app/adapters/auth/schemas.py` |
| Hash de contraseña | `backend/app/application/services/auth_service.py` |
| Reglas de orden/producto/usuario/perfil/chat | `backend/app/domain/entities/*.py` |
| Puertos (interfaces) | `backend/app/domain/ports/*.py` |
| Casos de uso | `backend/app/application/use_cases/*.py` |
| Repositorios MySQL | `backend/app/infrastructure/repositories/mysql_*_repository.py` |
| Repositorios en memoria (chat) | `backend/app/infrastructure/repositories/memory_chat_repository.py` |
| Motor FAQ | `backend/app/infrastructure/faq_engine/keyword_faq_engine.py` |
| Routers HTTP | `backend/app/adapters/http/routers/*.py` |
| Esquemas Pydantic HTTP | `backend/app/adapters/http/schemas.py` |
| WebSocket y conexiones | `backend/app/realtime/{chat_ws_handler.py, connection_manager.py}` |
| Frontend, `CONFIG`, llamadas | `frontend/index.html` |
| Checkout y confirmación de orden (sin pago) | `frontend/index.html:1434-1682` |
| Menciones de pago (solo FAQ) | `backend/app/infrastructure/repositories/memory_chat_repository.py:68-79` |
| Dependencias | `requirements.txt`, `backend/requirements.txt` |
