# Retrospectiva · Sprint 5 → Sprint 6

> Borrador basado en el estado del repositorio al cierre del Sprint 5. Revísenlo en equipo y ajusten las conclusiones antes de entregarlo.

Dinámica usada: **estrella de mar**.

## 1. Comenzar a hacer

- Diseñar la base de datos con tablas relacionadas (DER) antes de escribir código de persistencia.
- Probar contra una base PostgreSQL real, no solo contra archivos JSON o adaptadores simulados.
- Dejar en el repositorio los entregables de cada sprint (diagramas, scripts SQL, retro) en cuanto se terminan.

## 2. Hacer más

- Pruebas automáticas de los flujos completos: registro, inicio de sesión, CRUD de productos y migración de datos.
- Completar la información comercial del catálogo (precios, tallas, colores) junto con el código, no al final.
- Revisar que el README describa lo que el sitio hace de verdad.

## 3. Continuar haciendo

- Despliegue continuo en Render con la base de datos en Neon y `/health` para comprobar el servicio.
- Cuidar la seguridad: contraseñas con `scrypt`, sesiones revocables, cookies `httpOnly`, cabeceras de seguridad y límites de solicitudes.
- Mantener separadas las rutas, los controladores, los modelos y las vistas.

## 4. Hacer menos

- Guardar los datos como bloques JSON dentro de una sola columna (`payload`): dificulta las consultas, las búsquedas y las relaciones.
- Duplicar la lógica de validación entre los adaptadores (JSON local y PostgreSQL).

## 5. Dejar de hacer

- Dejar scripts rotos en `package.json` (por ejemplo, uno que apuntaba a una prueba que no existía).
- Posponer tareas de datos que bloquean la experiencia del cliente, como los productos sin precio.

## Acuerdos para el Sprint 6

1. Diagrama entidad-relación y `structure.sql` antes de tocar el código.
2. Migrar a Sequelize sin perder los productos, clientes ni sesiones que ya están en Neon.
3. Agregar pruebas que corran contra PostgreSQL.
