# Arquitectura de VisagShop

Este documento describe el código del repositorio incluido en la entrega, no una especificación genérica.

## Organización

| Directorio | Responsabilidad |
| --- | --- |
| `app.js` | Configuración Express, cabeceras básicas, rutas, estáticos, errores y arranque. |
| `routes/` | Endpoints para páginas, productos, administrador y cuentas. |
| `controllers/` | Controladores de páginas, cuentas y productos. |
| `views/` | Plantillas EJS y componentes reutilizables (`partials/`). |
| `public/` | JavaScript y CSS del navegador, además de imágenes originales. |
| `models/` | Modelos locales y selección de backend activo. |
| `cloud/` | Adaptadores de PostgreSQL para productos, usuarios, sesiones y fotografías. |
| `middleware/` | Comprobaciones de sesión, invitado, administrador, origen y límites de solicitudes. |
| `data/` | Semilla de catálogo JSON y contador de referencias para desarrollo local. |
| `tests/` | Pruebas del catálogo, persistencia, acceso, seguridad básica y sesiones. |

## Flujo general

1. **Express** recibe la solicitud y carga los datos de la sesión.
2. Las rutas llaman a los **controladores** o consultan los modelos según corresponda.
3. Las vistas **EJS** presentan el catálogo y los formularios. El código JavaScript del navegador implementa filtros, carrito e interacciones.
4. El almacenamiento se elige según `DATABASE_URL`: sin ella se trabaja con archivos JSON locales; con ella, los modelos activos usan **PostgreSQL**.
5. Las imágenes originales están en `public/img`. Las imágenes agregadas en alojamiento cloud se guardan en PostgreSQL (`visag_uploads`) y se exponen mediante una ruta controlada.

## Notas sobre datos

- El sistema inicializa el catálogo de PostgreSQL una sola vez desde `data/products.json` y conserva los cambios posteriores.
- Las cuentas de clientes no se incluyen en este ZIP; se crean durante la ejecución.
- Los archivos `data/users.json` y `data/sessions.json` están excluidos del repositorio.
- El carrito y los favoritos del navegador emplean almacenamiento local para la experiencia de uso; **no existe un sistema de órdenes persistidas** en PostgreSQL.
- La solicitud de pedido se prepara para WhatsApp. La confirmación comercial ocurre fuera de la aplicación.

## Rutas de escritura

La administración de productos admite `POST`, `PUT` y `DELETE` a través de las rutas REST (protegidas por middleware administrativo). El acceso de usuarios se gestiona bajo `/api/account/` y exige verificación de sesión para perfil y cambios de contraseña.

## Despliegue

Para ejecutar el proyecto en Render se utilizan `npm install`, `npm start`, `NODE_ENV=production` y una `DATABASE_URL` privada de Neon. La aplicación atiende el `PORT` provisto por Render y dispone de `/health` para comprobación. El alojamiento gratuito puede suspenderse por inactividad.
