# Retrospectivas

> Borradores basados en el estado del repositorio al cierre de cada sprint. Revísenlos en equipo y ajusten las conclusiones antes de entregarlos.

Dinámica usada: **estrella de mar**.

---

## Sprint 6 → Sprint 7

### 1. Comenzar a hacer

- Validar todos los formularios en el servidor con **express-validator**, no solo dentro de los modelos.
- Mostrar los errores debajo de cada campo, con mensajes claros, en lugar de un único mensaje general.
- Revisar los textos del sitio (títulos, letreros, avisos) como parte de cada entrega.

### 2. Hacer más

- Pruebas contra PostgreSQL real: en el Sprint 6 detectaron que la migración y los scripts SQL funcionaban antes de publicar.
- Desplegar cambios pequeños y verificarlos en la tienda en línea justo después.

### 3. Continuar haciendo

- Migrar datos sin perder nada: las tablas anteriores quedaron como respaldo.
- Mantener el DER, `structure.sql` y los modelos de Sequelize sincronizados.

### 4. Hacer menos

- Pasos manuales con credenciales de producción (como el importador con `DATABASE_URL`): es fácil equivocarse y expone la contraseña de la base.

### 5. Dejar de hacer

- Dejar textos de sprints anteriores visibles para el cliente (avisos como «SPRINT 5 / TU CUENTA»).
- Mezclar idiomas en los letreros sin criterio (por ejemplo, «fit» y «streetwear» junto a textos en español).

### Acuerdos para el Sprint 7

1. Mismas reglas de validación en el servidor y en el navegador, definidas en un solo lugar en cada lado.
2. Foto de perfil opcional en el registro, validada por tipo y tamaño.
3. Revisar y unificar los letreros del sitio.

---

## Sprint 5 → Sprint 6

### 1. Comenzar a hacer

- Diseñar la base de datos con tablas relacionadas (DER) antes de escribir código de persistencia.
- Probar contra una base PostgreSQL real, no solo contra archivos JSON o adaptadores simulados.
- Dejar en el repositorio los entregables de cada sprint (diagramas, scripts SQL, retro) en cuanto se terminan.

### 2. Hacer más

- Pruebas automáticas de los flujos completos: registro, inicio de sesión, CRUD de productos y migración de datos.
- Completar la información comercial del catálogo (precios, tallas, colores) junto con el código, no al final.
- Revisar que el README describa lo que el sitio hace de verdad.

### 3. Continuar haciendo

- Despliegue continuo en Render con la base de datos en Neon y `/health` para comprobar el servicio.
- Cuidar la seguridad: contraseñas con `scrypt`, sesiones revocables, cookies `httpOnly`, cabeceras de seguridad y límites de solicitudes.
- Mantener separadas las rutas, los controladores, los modelos y las vistas.

### 4. Hacer menos

- Guardar los datos como bloques JSON dentro de una sola columna (`payload`): dificulta las consultas, las búsquedas y las relaciones.
- Duplicar la lógica de validación entre los adaptadores (JSON local y PostgreSQL).

### 5. Dejar de hacer

- Dejar scripts rotos en `package.json` (por ejemplo, uno que apuntaba a una prueba que no existía).
- Posponer tareas de datos que bloquean la experiencia del cliente, como los productos sin precio.

### Acuerdos para el Sprint 6

1. Diagrama entidad-relación y `structure.sql` antes de tocar el código.
2. Migrar a Sequelize sin perder los productos, clientes ni sesiones que ya están en Neon.
3. Agregar pruebas que corran contra PostgreSQL.
