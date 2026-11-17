# DESIGN.md — VisagShop

Guía visual de la tienda. Describe **cómo se ve VisagShop hoy** (valores que ganan en la cascada
actual), para que cualquier cambio futuro —de una persona o de un agente de IA— siga la misma línea
en vez de añadir otra capa de estilos.

> Regla de oro: antes de crear un color, tamaño o componente nuevo, busca aquí si ya existe.

## Personalidad

Moda urbana de Lebrija (Santander), al detal y por mayor. Editorial y minimalista: mucho papel
claro, tinta casi negra, fotos de producto reales como protagonistas, un acento lima y títulos
grandes con una palabra en serif cursiva (*"VISTE A TU manera."*). Nada de degradados, sombras
fuertes ni esquinas muy redondeadas.

## Colores (tokens vigentes, `public/css/atelier.css`)

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#1e1e1b` | Texto principal, botones oscuros, fondos de footer |
| `--paper` | `#f8f7f3` | Fondo general de la página |
| `--white` | `#ffffff` | Tarjetas, formularios, paneles |
| `--muted` | `#676762` | Texto secundario (descripciones, metadatos, ayudas) |
| `--line` | `#e5e4de` | Bordes y divisores |
| `--lime` | `#d5ed59` | Acento de marca: selección, insignias, detalles |
| `--blue-deep` | `#575f38` | Acento oscuro (oliva) para kickers y enlaces sobre claro |

Notas importantes:

- **`--blue` y `--blue-deep` ya no son azules.** Los nombres vienen de `style.css` (sprint 1); hoy
  valen lima y oliva. No crear nuevos usos de `--blue`: usar `--lime`.
- **Contraste mínimo:** todo texto debe tener al menos **4.5:1** contra su fondo (3:1 si es ≥ 24 px,
  o ≥ 18.5 px en negrita). Sobre `--paper` el gris más claro permitido para texto es `#676762`.
  En nov. 2026 se oscurecieron ~40 grises que no cumplían; no volver a aclararlos.
- Checkout usa su propia paleta (`--co-*` en `checkout.css`) con amarillo `#e2c900` para el método de
  pago seleccionado.

## Tipografía

Cargadas en `views/partials/head.ejs` (Google Fonts):

| Rol | Fuente | Detalles |
|---|---|---|
| Títulos (`--heading`) | **Space Grotesk** | 500–700, `letter-spacing:-.06em`, `line-height:1.08` |
| Texto (`--body`) | **DM Sans** | 14 px base, 400–800 |
| Acento | **Instrument Serif** | Solo en `h1 em` / `h2 em` / `.page-title h1 i`: la palabra final del título en cursiva, peso 400 |

- Kickers / eyebrows: mayúsculas, 10–11 px, `letter-spacing` amplio (.12–.17em), peso 700–800.
- **Tamaño mínimo en móvil:** 11 px para texto que hay que leer (categoría, tallas), 12 px para ayudas
  de formulario. La etiqueta "DISPONIBLE EN CATÁLOGO" de las tarjetas es la excepción decorativa.
- `Barlow Condensed` aparece en `style.css` pero **no se carga**; la sobrescribe `Space Grotesk`.

## Componentes

- **Botón** (`.btn`): esquinas rectas (`border-radius:0`), alto mínimo 52–55 px, texto 10 px en
  mayúsculas con `letter-spacing:.12em`, flecha `↗` a la derecha. Variantes: `.btn-dark` (tinta) y
  `.btn-primary`.
- **Tarjeta de producto** (`views/partials/productCard.ejs` y `public/js/catalog.js` — mantener ambas
  iguales): foto 4:5, etiqueta blanca arriba a la izquierda, corazón de favoritos arriba a la derecha,
  categoría en mayúsculas, nombre, precio en negrita y enlace "VER PRENDA ↗".
- **Formularios:** campos sobre blanco o `#fbfaf7`, borde gris claro, foco con contorno visible.
  Etiqueta siempre visible encima del campo; "(opcional)" en `--muted`.
- **Foco:** `:focus-visible` con contorno de 2–3 px; nunca quitarlo.
- **Movimiento:** transiciones cortas (.2–.5 s) en hover; todo se desactiva con
  `prefers-reduced-motion`.

## Fotos

- Originales en `public/img/pNNN.jpg` (≈540×720, JPG calidad 80).
- Versiones WebP en `public/img/w/` (`pNNN.webp` completa y `pNNN-360.webp` para tarjetas), generadas
  con `scripts/webpPhotos.sh`. **Al añadir una foto nueva al catálogo, ejecutar ese script**; un test
  (`tests/pages.test.js`) falla si falta alguna.
- Las vistas usan `photoSrcset()` (servidor: `res.locals`; navegador: `window.Visag.photoSrcset`).
- Siempre `alt` descriptivo, `width`/`height` y `loading="lazy"` salvo las primeras visibles.

## Puntos de quiebre

`1150px` · `900px` (tablet) · `680px` (móvil) · `520px` / `380px` (móviles pequeños).

## Accesibilidad (mínimos)

Enlace "saltar al contenido", un solo `h1` por página sin saltos de nivel (usar `h2.sr-only` si el
diseño no muestra el nivel intermedio), contraste AA, objetivos táctiles ≥ 44 px, `aria-live` en
contadores y mensajes de estado.

## Deuda conocida

1. **Capas de CSS por sprint.** Se cargan en este orden y se pisan entre sí:
   `style.css → modern.css → atelier.css → (checkout/admin) → sprint4.css → sprint5.css`.
   Los valores vigentes son los de esta guía. Pendiente: consolidarlas en un solo sistema.
2. **Salto de diseño intermitente en login/registro** (CLS ≈ 0.23 en algunas mediciones de
   Lighthouse móvil), probablemente por el cambio de fuente al cargar. Ya existía antes de nov. 2026.
3. Sobre 50 % del texto del inicio y del catálogo en móvil mide menos de 12 px (etiquetas
   editoriales). Es una decisión de estilo; revisar si afecta a clientes.
