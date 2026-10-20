# VisagShop —

**Objetivo:** probar VisagShop públicamente con **Render Free + Neon Free**, conservando la estética minimalista, catálogo, carrito, administración y autenticación. Los datos mutables (clientes, sesiones, productos, fotografías nuevas) se almacenan en PostgreSQL y sobreviven a reinicios de Render.

## En tu computador

1. Descomprime el ZIP. `package.json` está en esta misma carpeta.
2. Ejecuta `INICIAR_VISAGSHOP.bat` o abre VS Code en esta carpeta y ejecuta `npm install` seguido de `npm start`.
3. Entra a <http://localhost:3000>. Si no defines `DATABASE_URL`, **solo localmente** se usan archivos JSON para demostración.
4. El panel está en `/admin/products`, con usuario y contraseña propios configurados mediante `INICIAR_PANEL_ADMIN.bat` para desarrollo local.

## En Render Free

- Configura `NODE_ENV=production` y `DATABASE_URL` a **Neon PostgreSQL** (SSL requerido).
- El programa no permite arrancar en producción sin una base de datos remota: evita perder cuentas, sesiones y fotos al dormir Render.
- Configura `ADMIN_USERNAME`, `ADMIN_PASSWORD` y, opcionalmente, `WHATSAPP_NUMBER`.
- Las 108 fotografías originales permanecen en `/public/img`; nuevas imágenes se almacenan en PostgreSQL.
- `render.yaml` está incluido como referencia para crear un Render Blueprint, pero puedes configurar el Web Service manualmente (más sencillo para el primer despliegue).
- Salud: `GET /health`.

## Seguridad / restricciones

Esta edición gratuita **no es alojamiento garantizado 24/7** ni sustituye infraestructura profesional para procesar pagos o almacenar datos reales de clientes. No recopila números de tarjetas. Las opciones Nequi y tarjeta coordinan pagos externos; WhatsApp requiere su número real y un cliente enviando el mensaje.

Pruebas: `npm test`. Revisa la guía de publicación para las limitaciones y la lista de verificación en un navegador real.

Los documentos académicos `retro.md`, `tablero_sprint5.md` y las guías anteriores están incluidos; los nombres de integrantes o acuerdos deben completarse con información real del equipo.
