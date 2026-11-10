# Arquitectura de VisagShop

Este documento describe el código del repositorio incluido en la entrega, no una especificación genérica.

## Organización

| Directorio | Responsabilidad |
| --- | --- |
| `app.js` | Configuración Express, cabeceras básicas, rutas, estáticos, errores y arranque. |
| `routes/` | Endpoints para páginas, productos (con buscador), administrador y cuentas. |
| `controllers/` | Controladores de páginas, cuentas y productos. |
| `views/` | Plantillas EJS y componentes reutilizables (`partials/`). |
| `public/` | JavaScript y CSS del navegador, además de imágenes originales. |
| `database/` | Todo lo de la base de datos (Sprint 6): ver la sección siguiente. |
| `models/` | Modelos JSON para desarrollo local sin base de datos y selección del almacenamiento activo (`activeProducts`, `activeUsers`). |
| `middleware/` | Comprobaciones de sesión, invitado, administrador, origen, límites de solicitudes y `validate.js` (respuesta de express-validator). |
| `validations/` | Sprint 7: reglas de express-validator para usuarios y productos, reglas compartidas y validación de imágenes. |
| `data/` | Catálogo semilla (`products.json`) y datos locales de desarrollo. |
| `scripts/` | Generación de `data.sql`, importación de precios y usuarios de demostración. |
| `tests/` | Pruebas del catálogo, del importador y de la base de datos con PostgreSQL. |
| `docs/sprint6/` | Diagrama entidad-relación (`DER-VisagShop.pdf`) y su fuente HTML. |

## Base de datos (Sprint 6)

| Archivo | Contenido |
| --- | --- |
| `database/structure.sql` | Crea la base `visagshop`, todas las tablas, tipos, restricciones y claves foráneas. |
| `database/data.sql` | Pobla categorías, tallas, colores, los 108 productos con sus relaciones y dos usuarios de demostración. Se genera con `npm run db:data-sql`. |
| `database/config/config.js` | Configuración de Sequelize (la usa también `sequelize-cli` mediante `.sequelizerc`). |
| `database/models/` | Modelos de Sequelize con sus relaciones: `Category`, `Size`, `Color`, `Upload`, `Product`, `ProductSize`, `ProductColor`, `User`, `Session`. |
| `database/repositories/` | CRUD de productos, usuarios y sesiones escrito con Sequelize. |
| `database/setup.js` | Preparación al arrancar: crea las tablas que falten y carga los datos iniciales. |

### Tablas y relaciones

- `categories` 1 — N `products` (`products.category_id`).
- `products` N — M `sizes` mediante `product_sizes` (con `position` para respetar el orden de las tallas).
- `products` N — M `colors` mediante `product_colors`.
- `uploads` 0..1 — 0..1 `products` (`products.upload_id`): fotos subidas desde el panel.
- `users` 1 — N `sessions` (`sessions.user_id`).
- `uploads` 0..1 — 0..1 `users` (`users.upload_id`): foto de perfil (Sprint 7).

La referencia de cada producto (`p001`, `p002`…) se mantiene como clave primaria porque aparece en las URLs y en los carritos guardados por los clientes. Las referencias nuevas salen de la secuencia `product_number_seq`, así nunca se reutiliza la de un producto eliminado.

### Arranque y migración desde el Sprint 5

Al iniciar con `DATABASE_URL`, `database/setup.js`:

1. Crea las tablas que no existan a partir de los modelos (`sequelize.sync()` sin `alter`: nunca modifica ni borra tablas).
2. Si la tabla `products` está vacía y existen las tablas del Sprint 5 (`visag_products`, `visag_users`, `visag_sessions`, `visag_uploads`), copia productos, fotos, clientes y sesiones activas al esquema nuevo. Las contraseñas siguen siendo válidas porque se copia el mismo hash.
3. Si no hay datos anteriores, carga el catálogo de `data/products.json`.
4. Ajusta la secuencia de referencias para continuar después de la última usada.

Las tablas `visag_*` no se borran: quedan como respaldo hasta que se decida eliminarlas a mano.

## Flujo general

1. **Express** recibe la solicitud y carga la sesión del cliente.
2. Las rutas llaman a los **controladores**, que usan el almacenamiento activo.
3. El almacenamiento se elige según `DATABASE_URL`: con ella se usa **PostgreSQL con Sequelize**; sin ella, archivos JSON locales para poder abrir el proyecto sin instalar una base de datos.
4. Las vistas **EJS** presentan el catálogo y los formularios. El JavaScript del navegador implementa filtros, carrito e interacciones.
5. Las imágenes originales están en `public/img`. Las fotos subidas en la nube se guardan en la tabla `uploads` y se sirven en `/img/uploads/<id>.<ext>`.

## CRUD disponible

| Entidad | Crear | Editar | Eliminar | Listar | Detalle | Buscar |
| --- | --- | --- | --- | --- | --- | --- |
| Productos | `POST /products` | `PUT /products/:id` | `DELETE /products/:id` | `GET /products` | `GET /products/:id` | `GET /products?q=…&categoria=…` |
| Usuarios | `POST /api/account/register` | `PUT /api/account/profile` y `/password` | — | — | `GET /profile` | — |

Crear, editar y eliminar productos exige credenciales de administrador (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). El panel está en `/admin/products`.

## Notas sobre datos

- Las cuentas de clientes no se incluyen en el repositorio; se crean durante la ejecución. `data.sql` solo trae dos cuentas ficticias de demostración.
- El carrito y los favoritos usan el almacenamiento del navegador; **no existe un sistema de órdenes persistidas** (el carrito en base de datos era opcional en el Sprint 6).
- La solicitud de pedido se prepara para WhatsApp. La confirmación comercial ocurre fuera de la aplicación.

## Despliegue

Render ejecuta `npm install` y `npm start` con `NODE_ENV=production` y una `DATABASE_URL` privada de Neon. La aplicación atiende el `PORT` provisto por Render y dispone de `/health` para comprobación. El alojamiento gratuito puede suspenderse por inactividad.
