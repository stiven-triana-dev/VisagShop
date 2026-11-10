'use strict';
// Sprint 7 · Validaciones del back-end (express-validator) probadas por HTTP.
// Usa el almacenamiento JSON en una carpeta temporal: no toca data/ ni ninguna base.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visag-validations-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.VISAG_DATA_DIR = tmp;
process.env.ADMIN_USERNAME = 'admin_prueba';
process.env.ADMIN_PASSWORD = 'clave-admin-prueba';

let server, base;
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const fakePng = 'data:image/png;base64,' + Buffer.from('esto no es una imagen de verdad').toString('base64');
const admin = 'Basic ' + Buffer.from('admin_prueba:clave-admin-prueba').toString('base64');

async function post(url, body, {method = 'POST', headers = {}} = {}) {
  const res = await fetch(base + url, {method, headers: {'Content-Type': 'application/json', Origin: base, ...headers}, body: JSON.stringify(body)});
  return {status: res.status, body: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie')};
}

before(async () => {
  const {app} = require('../app');
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
});

const valid = {firstName: 'Laura', lastName: 'Gómez', email: 'laura@example.test', password: 'Segura#2026', confirm: 'Segura#2026'};

test('registro: campos obligatorios, formato y longitud', async () => {
  const r = await post('/api/account/register', {firstName: 'L', lastName: '', email: 'no-es-correo', password: 'corta', confirm: 'otra'});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.firstName, /al menos 2/);
  assert.match(r.body.errors.lastName, /obligatorio/);
  assert.match(r.body.errors.email, /válido/);
  assert.match(r.body.errors.password, /al menos 8/);
  assert.match(r.body.errors.confirm, /no coinciden/);
});

test('registro: la contraseña exige mayúscula, minúscula, número y carácter especial', async () => {
  const r = await post('/api/account/register', {...valid, password: 'sinmayuscula1!', confirm: 'sinmayuscula1!'});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.password, /mayúscula/);
});

test('registro: la foto debe ser una imagen real', async () => {
  const r = await post('/api/account/register', {...valid, imageData: fakePng});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.imageData, /imagen válida/);
});

test('registro válido con foto GIF y correo repetido rechazado', async () => {
  const ok = await post('/api/account/register', {...valid, imageData: gif});
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.match(ok.body.user.avatar, /^\/img\/uploads\/[a-f0-9-]{36}\.gif$/);
  const again = await post('/api/account/register', {...valid, firstName: 'Otra'});
  assert.equal(again.status, 400);
  assert.match(again.body.errors.email, /Ya existe/);
});

test('login: correo registrado y contraseña correcta', async () => {
  let r = await post('/api/account/login', {email: '', password: ''});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.email, /obligatorio/);
  assert.match(r.body.errors.password, /obligatoria/);
  r = await post('/api/account/login', {email: 'nadie@example.test', password: 'Algo#1234'});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.email, /No hay una cuenta/);
  r = await post('/api/account/login', {email: valid.email, password: 'Incorrecta#1'});
  assert.equal(r.status, 401);
  assert.match(r.body.errors.password, /no es correcta/);
  r = await post('/api/account/login', {email: 'LAURA@example.test', password: valid.password});
  assert.equal(r.status, 200);
});

test('productos: nombre, descripción, categoría, precio e imagen', async () => {
  const headers = {Authorization: admin};
  let r = await post('/products', {nombre: 'Gorr', descripcion: 'muy corta', categoria: 'Inventada', precio: '12.5'}, {headers});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.nombre, /al menos 5/);
  assert.match(r.body.errors.descripcion, /al menos 20/);
  assert.match(r.body.errors.categoria, /no existe/);
  assert.match(r.body.errors.precio, /entero/);
  assert.match(r.body.errors.imageData, /fotografía/);

  r = await post('/products', {nombre: 'Gorra de prueba', categoria: 'Gorras', imageData: fakePng}, {headers});
  assert.equal(r.status, 400);
  assert.match(r.body.errors.imageData, /imagen válida/);

  r = await post('/products', {nombre: 'Gorra de prueba', descripcion: '', categoria: 'Gorras', precio: '45000', imageData: gif}, {headers});
  assert.equal(r.status, 201, JSON.stringify(r.body));

  // Al editar, la foto es opcional y la descripción vacía está permitida.
  r = await post(`/products/${r.body.id}`, {nombre: 'Gorra de prueba editada', descripcion: 'Gorra ajustable con logo bordado al frente.', categoria: 'Gorras', precio: ''}, {method: 'PUT', headers});
  assert.equal(r.status, 200, JSON.stringify(r.body));
});
