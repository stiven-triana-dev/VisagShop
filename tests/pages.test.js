'use strict';
// Paginación del listado, caché de archivos y vista previa al compartir enlaces.
// Usa el almacenamiento JSON en una carpeta temporal: no toca data/ ni ninguna base.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visag-pages-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.VISAG_DATA_DIR = tmp;

let server, base;
before(async () => {
  const {app} = require('../app');
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
});

const cards = html => (html.match(/class="product-card"/g) || []).length;

test('el listado muestra 24 productos por página y enlaces que conservan la búsqueda', async () => {
  const first = await (await fetch(`${base}/products`)).text();
  assert.equal(cards(first), 24);
  assert.match(first, /108 referencias · Página 1 de 5/);
  assert.match(first, /href="\/products\?page=2" rel="next"/);

  const last = await (await fetch(`${base}/products?page=5`)).text();
  assert.equal(cards(last), 108 - 4 * 24);
  assert.match(last, /aria-current="page">5</);

  const outOfRange = await (await fetch(`${base}/products?page=99`)).text();
  assert.match(outOfRange, /Página 5 de 5/, 'una página que no existe muestra la última');

  const gorras = await (await fetch(`${base}/products?categoria=Gorras&page=2`)).text();
  assert.match(gorras, /41 resultados en Gorras · Página 2 de 2/);
  assert.match(gorras, /href="\/products\?categoria=Gorras" rel="prev"/);

  const nike = await (await fetch(`${base}/products?q=nike`)).text();
  assert.equal(cards(nike), 6);
  assert.doesNotMatch(nike, /class="pagination"/, 'sin paginación cuando cabe en una página');
});

test('CSS y JS con versión se guardan en caché; las fotos, 7 días', async () => {
  const home = await (await fetch(base + '/')).text();
  const css = /href="(\/css\/style\.css\?v=[a-f0-9]{10})"/.exec(home)?.[1];
  assert.ok(css, 'los estilos llevan versión');
  assert.match((await fetch(base + css)).headers.get('cache-control'), /max-age=31536000, immutable/);
  assert.match((await fetch(base + '/css/style.css')).headers.get('cache-control'), /max-age=3600/, 'sin versión, caché corta');
  assert.match((await fetch(base + '/img/p042.jpg')).headers.get('cache-control'), /max-age=604800/);
});

test('la ficha de producto trae vista previa con su foto y precio', async () => {
  const html = await (await fetch(`${base}/products/p042`)).text();
  assert.match(html, new RegExp(`<meta property="og:image" content="${base}/img/p042\\.jpg">`));
  assert.match(html, /<meta property="og:type" content="product">/);
  assert.match(html, /<meta name="description" content="\$\s?130\.000 · Tallas: 24-4, 26-6/);
  assert.match(html, /<link rel="canonical" href="[^"]+\/products\/p042">/);
});
