'use strict';
// Pedidos guardados: validación, precios del servidor, panel y "Mis pedidos".
// Usa el almacenamiento JSON en una carpeta temporal: no toca data/ ni ninguna base.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visag-orders-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.VISAG_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin_prueba';
process.env.ADMIN_PASSWORD = 'clave-admin-prueba';

let server, base;
const admin = 'Basic ' + Buffer.from('admin_prueba:clave-admin-prueba').toString('base64');
const send = async (url, body, {method = 'POST', headers = {}} = {}) => {
  const res = await fetch(base + url, {method, headers: {'Content-Type': 'application/json', Origin: base, ...headers}, body: JSON.stringify(body)});
  return {status: res.status, body: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie')};
};
const customer = {
  nombre: 'Camila', apellidos: 'Torres', celular: '300 123 4567', email: 'camila@example.test',
  departamento: 'Santander', ciudad: 'Lebrija', direccion: 'Calle 12 #12-57', 'medio-pago': 'nequi', facturacion: 'misma'
};

before(async () => {
  const {app} = require('../app');
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
});

test('rechaza pedidos incompletos con un mensaje por campo', async () => {
  const r = await send('/api/orders', {items: [], nombre: 'C', celular: 'abc', 'medio-pago': 'bitcoin'});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.items, /vacío/);
  assert.match(r.body.errors.nombre, /al menos 2/);
  assert.match(r.body.errors.apellidos, /obligatorio/);
  assert.match(r.body.errors.celular, /celular válido/);
  assert.match(r.body.errors.direccion, /obligatori/);
  assert.match(r.body.errors['medio-pago'], /método de pago/);
});

test('rechaza tallas que la prenda no tiene y productos inexistentes', async () => {
  let r = await send('/api/orders', {...customer, items: [{id: 'p042', talla: 'XXXL', cant: 1}]});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.items, /talla XXXL no está disponible/);
  r = await send('/api/orders', {...customer, items: [{id: 'p999', talla: '', cant: 1}]});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.items, /ya no está disponible/);
});

test('guarda el pedido con número y con los precios del catálogo, no los del navegador', async () => {
  const r = await send('/api/orders', {...customer, items: [
    {id: 'p042', talla: '28-8', cant: 2, precio: 1},  // el precio enviado se ignora
    {id: 'p001', talla: 'Ajustable', cant: 1}
  ]});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.code, 'VS-1001');
  assert.equal(r.body.subtotal, 130000 * 2 + 45000);
  assert.equal(r.body.mine, false);
  const second = await send('/api/orders', {...customer, items: [{id: 'p098', talla: '', cant: 1}]});
  assert.equal(second.body.code, 'VS-1002');
});

test('el panel lista los pedidos, muestra el detalle y cambia el estado', async () => {
  assert.equal((await fetch(`${base}/admin/orders`)).status, 401, 'requiere credenciales');
  const list = await (await fetch(`${base}/admin/orders`, {headers: {Authorization: admin}})).text();
  assert.match(list, /VS-1002/);
  assert.match(list, /VS-1001/);
  const detail = await (await fetch(`${base}/admin/orders/1001`, {headers: {Authorization: admin}})).text();
  assert.match(detail, /Camila Torres/);
  assert.match(detail, /Jean baggy · Negro/);
  assert.match(detail, /wa\.me\/573001234567/);

  let r = await send('/admin/api/orders/1001', {status: 'perdido'}, {method: 'PUT', headers: {Authorization: admin}});
  assert.equal(r.status, 400);
  r = await send('/admin/api/orders/1001', {status: 'confirmado', adminNote: 'Pagó por Nequi.'}, {method: 'PUT', headers: {Authorization: admin}});
  assert.equal(r.status, 200);
  assert.equal(r.body.statusLabel, 'Confirmado');
  const filtered = await (await fetch(`${base}/admin/orders?estado=confirmado`, {headers: {Authorization: admin}})).text();
  assert.match(filtered, /VS-1001/);
  assert.doesNotMatch(filtered, /VS-1002/);
});

test('el cliente con sesión ve sus pedidos en el perfil', async () => {
  const reg = await send('/api/account/register', {firstName: 'Camila', lastName: 'Torres', email: 'camila@example.test', password: 'Segura#2026', confirm: 'Segura#2026'});
  assert.equal(reg.status, 201);
  const cookie = reg.cookie.split(';')[0];
  const r = await send('/api/orders', {...customer, items: [{id: 'p025', talla: '7 1/2', cant: 1}]}, {headers: {Cookie: cookie}});
  assert.equal(r.status, 201);
  assert.equal(r.body.mine, true);
  const profile = await (await fetch(`${base}/profile`, {headers: {Cookie: cookie}})).text();
  assert.match(profile, new RegExp(`Pedido ${r.body.code}`));
  assert.doesNotMatch(profile, /Pedido VS-1001/, 'no muestra pedidos de otras personas');
});
