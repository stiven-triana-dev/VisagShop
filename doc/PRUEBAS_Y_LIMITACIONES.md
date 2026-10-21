# Pruebas y limitaciones verificadas

## Qué se ha comprobado sobre este ZIP

- `package.json` dispone de scripts para iniciar, comprobar sintaxis y ejecutar `node:test`.
- El catálogo inicial incluye 108 productos y las 108 rutas de fotografía referenciadas existen.
- No se incluyen los archivos de cuentas/sesiones de clientes (`data/users.json`, `data/sessions.json`); están en `.gitignore`.
- Se ajustó **una prueba** de contrato (`tests/sprint4Contract.test.js`) para aceptar esa ausencia intencional. La lógica de la tienda no se modificó.
- Tras ese ajuste, la suite completa (`npm test`) termina correctamente en el entorno de revisión.

## Limitaciones comerciales

- El checkout **no procesa pagos**; solo recoge una modalidad para coordinar con la tienda (contraentrega, Nequi o tarjeta a través de un eventual enlace de pago seguro).
- No existe un registro persistente de pedidos enviados. El usuario debe completar el envío del mensaje de WhatsApp.
- La ficha visual con fotografías se descarga o comparte aparte; un enlace normal de WhatsApp no puede adjuntar imágenes automáticamente.
- La recuperación de contraseñas mediante correo no está configurada.
- En el catálogo de semilla hay productos sin precio visible y sin tallas.
- Si no se configura `WHATSAPP_NUMBER`, se muestra una alternativa para copiar el mensaje, no un chat precargado al número oficial.

## Antes de usar con público real

- Verificar las credenciales del administrador, rotar contraseñas reveladas previamente y no incluir secretos en Git ni en su historial.
- Ejecutar pruebas de navegación en dispositivos reales, pruebas de carga, accesibilidad y pruebas de seguridad antes de manejar información sensible.
- Revisar privacidad, tratamiento de datos, políticas de cambios, envíos, condiciones de pago y las obligaciones comerciales aplicables.
- Implementar copias de seguridad y restauración de la base de datos PostgreSQL.
- Comprobar que los límites y suspensiones del alojamiento gratuito sean adecuados; **Render Free no garantiza disponibilidad continua**.

## Evidencias para tu portafolio

1. Captura del inicio en escritorio y móvil.
2. Captura de catálogo con filtros.
3. Captura del carrito con pedido demostrativo sin datos personales reales.
4. Capturas del panel administrativo **sin contraseñas ni datos de clientes**.
5. Registro de ejecución de `npm test` y descripción de casos principales.

> El repositorio ZIP **no contiene el historial Git**, por lo que el análisis de archivos no prueba que nunca se hayan publicado secretos en commits anteriores. Si hubo exposición, deben rotarse los secretos y, si corresponde, limpiarse el historial.
