# VisagShop · Publicación de prueba (Render + Neon)

Esta versión permite probarla en una URL gratuita de Render, **sin comprar `visagshop.com`**. Incluye catálogo, carrito, cuentas, sesiones y administración con datos persistentes en Neon.

No es una solución comercial garantizada 24/7. Render Free se duerme después de 15 minutos sin tráfico; un visitante puede esperar aproximadamente un minuto al entrar. Los planes gratuitos tienen límites y pueden cambiar. Usa datos ficticios en las pruebas iniciales.

## PASO 1

1. Cuenta gratuita de **GitHub**: https://github.com/
2. Cuenta gratuita de **Neon**: https://console.neon.tech/
3. Cuenta gratuita de **Render**: https://dashboard.render.com/
4. **Git para Windows** instalado si vas a subir el código desde VS Code: https://git-scm.com/downloads/win

## PASO 2 Crear la base de datos Neon 

1. Abrimos Neon → **New Project**. Elige un nombre, por ejemplo `visagshop-demo`, y selecciona **Free**.
2. En el panel del proyecto, copia la **cadena de conexión PostgreSQL** (preferiblemente `pooled connection`). Tiene este formato: `postgresql://...neon.tech/neondb?sslmode=require`.
3. Guarda esa cadena de manera privada. Contiene la **contraseña real de la base de datos**. No la copies dentro del ZIP, no la pongas en archivos `.js`, ni en GitHub.
4. **No hace falta crear las tablas a mano:** al iniciar la web por primera vez, el servidor prepara las tablas, copia los 108 productos originales y deja usuarios y sesiones vacíos.

Algo a tener en cuenta: Neon tiene límites de almacenamiento, comprueba en tu panel cuánto llevas consumido. Esta solución guarda fotografías nuevas en la misma base de datos para evitar pérdidas en el disco temporal de Render, dato a tener en cuenta no subir imágenes muy pesadas.

## PASO 3 como Subir el proyecto a GitHub

El archivo `package.json` debe quedar en la **raíz del repositorio**, al mismo nivel que `app.js` y `render.yaml`.

1. Descomprime el ZIP entero y abre **esa carpeta** en Visual Studio Code (`Archivo → Abrir carpeta`).
2. Confirma con `dir package.json` que estás en la carpeta correcta.
3. En GitHub, crea un **repositorio privado** llamado, por ejemplo, `visagshop`, **sin README nuevo** (el proyecto ya trae uno).
4. En la terminal de VS Code, ejecuta, uno por uno:

```powershell o CMD
git init
git add .
git commit -m "VisagShop Sprint 5 - despliegue gratuito"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/visagshop.git
git push -u origin main
```

Reemplaza **TU_USUARIO** por tu usuario real de GitHub. Autoriza el acceso en la ventana que muestre Git o GitHub, si te lo solicita.

Antes de subir, comprueba `git status` y `git diff --cached --name-only`: `.env`, `data/users.json`, `data/sessions.json` y `node_modules/` **no** deben estar incluidos. Los archivos `data/products.json` son el catálogo inicial sin datos de clientes y sí deben subir.

Si no tienes Git, puedes usar la opción **Source Control → Publish to GitHub** de VS Code después de abrir exactamente esta carpeta.

## PASO 4 Crear el Render

1. Abre Render → **New → Web Service** y conecta tu cuenta de GitHub.
2. Selecciona el repositorio de VisagShop.
3. Configura:
   - **Runtime:** Node
   - **Plan:** Free
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
   - **Root Directory:** déjalo vacío cuando `package.json` está en la raíz.
4. En **Environment**, agrega exactamente estos nombres (sin comillas):

| Nombre | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | **Tu conexión privada de Neon** |
| `ADMIN_USERNAME` | Usuario elegido por ti para el panel |
| `ADMIN_PASSWORD` | Clave larga y única, al menos 16 caracteres recomendados |
| `WHATSAPP_NUMBER` | Opcional: número real de la tienda sin `+` ni espacios, por ejemplo `57` más los 10 dígitos reales |

5. Pulsa **Deploy Web Service**. La primera publicación puede tardar varios minutos.
6. Render te dará una dirección del estilo `https://visagshop-xxxx.onrender.com`. **Esta será la URL real** para compartir, sin comprar dominio. El sufijo exacto se asigna en Render y no se puede garantizar de antemano.
7. Comprueba `https://TU-URL.onrender.com/health`: debe responder `{ "status": "ok" }` y la portada debe mostrar el catálogo.
8. Accede a `https://TU-URL.onrender.com/admin/products` usando las credenciales configuradas en Render.

**Si aparece un error:** ve a Render → tu servicio → **Logs**. `DATABASE_URL` debe estar bien escrita. Sin `DATABASE_URL`, el sistema detiene el arranque en producción para proteger tus datos.

## PASO 5 Probar todas las funciones

1. Abre la tienda desde otro teléfono usando la URL `onrender.com`.
2. Navega por categorías y abre un producto; su foto y precio deben mostrarse.
3. Registra una **cuenta de prueba**, entra, marca *Recordarme* y abre `/profile`.
4. Cierra sesión e intenta entrar a `/profile` otra vez: debe pedir login.
5. En administración, crea un producto de prueba **con foto**; edítalo y comprueba que aparece en el catálogo.
6. **Importante:** desde Render pulsa **Manual Deploy → Deploy latest commit** (si procede) o reinicia el servicio y verifica que siguen la cuenta, producto y foto. Neon conserva estos datos aunque Render borre su disco temporal.
7. Comprueba el carrito, talla, cantidad y método de pago. WhatsApp envía **un mensaje listo para que el cliente pulse Enviar**, no cobra tarjetas ni envía imágenes adjuntas automáticamente.
8. Cuando termines, elimina cuentas y productos ficticios desde las herramientas disponibles. Las cuentas de clientes no cuentan todavía con un botón de borrado; para pruebas usa direcciones `@example.test` y restaura el proyecto de Neon si es necesario, con conocimiento de lo que se eliminará.

## PASO 6 Los Límites y seguridad

**Lo que no garantiza el plan gratuito:** disponibilidad continua, respuestas instantáneas, un dominio `.com`, respaldos ilimitados o recursos de producción para clientes reales. Render Free se suspende tras 15 minutos sin visitas, puede reiniciarse y **pierde archivos guardados localmente**; Neon conserva su base de datos pero también está sujeto a cuotas y cambios del servicio.

**Protecciones implementadas:** contraseñas con `scrypt`, cookies `HttpOnly` y `Secure` sobre HTTPS, sesiones con tokens hash en Neon, redirección de rutas protegidas, consultas SQL parametrizadas, validación de fotos y límites de solicitudes por IP, verificación de origen en escrituras, cabeceras HTTP de seguridad. Solo se guarda la información de contacto imprescindible para la cuenta de prueba, nunca los números de tarjetas.

**Responsabilidades al publicarla:** no compartas la contraseña `DATABASE_URL`; evita publicar datos reales de clientes sin consentimiento y política de privacidad verificable; actualiza dependencias y haz pruebas de penetración y de seguridad antes de una tienda comercial; cambia credenciales comprometidas; mantén copias de seguridad cifradas fuera de Neon (p. ej. exportación PostgreSQL con `pg_dump`/Neon Console), y prueba su restauración periódicamente. El plan gratuito no equivale a un backup empresarial.

La autenticación HTTP Basic para administración sigue siendo apropiada para demostraciones sobre HTTPS, pero una tienda comercial requerirá autenticación administrativa reforzada, controles CSRF y 2FA, validación de pedidos en backend, sistema de pagos auditado, políticas legales y gestión de incidentes. La limitación de intentos basada en memoria se reinicia cuando Render reinicia; no es protección total contra bots.

##  ¿Y  PORQUE NO SALE visagshop.com?

Puedes usar el subdominio `onrender.com` **sin comprar** dominio. `visagshop.com`, si está disponible, requiere registro y renovación de pago. Cuando decidas comprarlo, Render puede asociar el dominio y activar HTTPS administrado en un plan compatible.
