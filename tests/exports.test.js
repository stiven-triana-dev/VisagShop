'use strict';
// Descargas del panel (Excel y respaldo) y archivos para buscadores (robots y sitemap).
// Usa el almacenamiento JSON en una carpeta temporal: no toca data/ ni ninguna base.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visag-exports-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.VISAG_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin_prueba';
process.env.ADMIN_PASSWORD = 'clave-admin-prueba';

let server, base;
const admin = {Authorization: 'Basic ' + Buffer.from('admin_prueba:clave-admin-prueba').toString('base64')};
const order = {
  nombre: 'Camila', apellidos: 'Torres', celular: '+57 300 123 4567', departamento: 'Santander', ciudad: 'Lebrija',
  direccion: 'Calle 12 #12-57; local 4', 'medio-pago': 'nequi', facturacion: 'misma', privacy: 'on'
};
const post = (url, body, headers = {}) => fetch(base + url, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: base, ...headers}, body: JSON.stringify(body)});

before(async () => {
  const {app} = require('../app');
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  await post('/api/orders', {...order, items: [{id: 'p042', talla: '28-8', cant: 2}, {id: 'p001', talla: 'Ajustable', cant: 1}]});
  await post('/api/orders', {...order, nombre: '=HYPERLINK("x")', items: [{id: 'p098', talla: '', cant: 1}]});
  await post('/api/account/register', {firstName: 'Camila', lastName: 'Torres', email: 'camila@example.test', password: 'Segura#2026', confirm: 'Segura#2026', privacy: 'on'});
  await fetch(`${base}/admin/api/orders/1001`, {method: 'PUT', headers: {'Content-Type': 'application/json', Origin: base, ...admin}, body: JSON.stringify({status: 'confirmado'})});
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
});

test('descarga los pedidos en un CSV que Excel abre bien', async () => {
  assert.equal((await fetch(`${base}/admin/orders/export.csv`)).status, 401, 'requiere credenciales');
  const res = await fetch(`${base}/admin/orders/export.csv`, {headers: admin});
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="visagshop-pedidos-\d{4}-\d{2}-\d{2}\.csv"/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM para que Excel muestre las tildes');
  const lines = bytes.subarray(3).toString('utf8').trim().split('\r\n');
  assert.equal(lines.length, 3, 'encabezado + 2 pedidos');
  assert.ok(lines[0].startsWith('Pedido;Fecha;Estado;Nombre;Apellido;Celular'));
  const first = lines.find(l => l.startsWith('VS-1001;'));
  assert.ok(first.includes(';Confirmado;Camila;Torres;'));
  assert.ok(first.includes("'+57 300 123 4567"), 'el + inicial no se interpreta como fórmula');
  assert.ok(first.includes('"Calle 12 #12-57; local 4"'), 'el punto y coma dentro de un dato va entre comillas');
  assert.ok(first.includes('2 x Jean baggy · Negro (28-8) | 1 x Gorra curva · Negra 01 (Ajustable)'));
  assert.ok(first.includes(';305000;No;'));
  const second = lines.find(l => l.startsWith('VS-1002;'));
  assert.ok(second.includes(`;"'=HYPERLINK(""x"")";`), 'una fórmula escrita por el cliente queda como texto');

  const filtered = await (await fetch(`${base}/admin/orders/export.csv?estado=confirmado`, {headers: admin})).text();
  assert.equal(filtered.replace(/^﻿/, '').trim().split('\r\n').length, 2);
});

test('descarga un respaldo con productos, pedidos y clientes, sin contraseñas', async () => {
  assert.equal((await fetch(`${base}/admin/backup.json`)).status, 401);
  const res = await fetch(`${base}/admin/backup.json`, {headers: admin});
  assert.match(res.headers.get('content-disposition'), /visagshop-respaldo-\d{4}-\d{2}-\d{2}\.json/);
  const text = await res.text();
  const backup = JSON.parse(text);
  assert.equal(backup.productos.length, 108);
  assert.equal(backup.pedidos.length, 2);
  assert.equal(backup.clientes.length, 1);
  assert.doesNotMatch(text, /scrypt\$/, 'sin hashes de contraseñas');
});

test('robots.txt y sitemap.xml para buscadores', async () => {
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/admin/);
  assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`));
  const res = await fetch(`${base}/sitemap.xml`);
  assert.match(res.headers.get('content-type'), /application\/xml/);
  const xml = await res.text();
  assert.equal((xml.match(/<loc>/g) || []).length, 2 + 6 + 108, 'inicio, colección, 6 categorías y 108 productos');
  assert.ok(xml.includes(`<loc>${base}/products/p042</loc>`));
  assert.ok(xml.includes(`<loc>${base}/products?categoria=Gorras</loc>`));
});
