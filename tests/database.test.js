'use strict';
// Pruebas contra un PostgreSQL real. Se ejecutan solo si existe TEST_DATABASE_URL:
//   TEST_DATABASE_URL=postgresql://usuario:clave@localhost:5432/postgres npm run test:db
// Con esa conexión se crean bases temporales (visag_test_*) que se borran al final;
// la base indicada en la URL no se modifica. Nunca uses la URL de producción.
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const adminUrl = process.env.TEST_DATABASE_URL;
const skip = !adminUrl && 'Define TEST_DATABASE_URL para probar con PostgreSQL';
const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
const created = [];

const urlFor = name => { const u = new URL(adminUrl); u.pathname = '/' + name; return u.toString(); };
async function admin(sql) {
  const {Client} = require('pg');
  const client = new Client(adminUrl);
  await client.connect();
  try { return await client.query(sql); } finally { await client.end(); }
}
async function newDatabase() {
  const name = `visag_test_${crypto.randomBytes(4).toString('hex')}`;
  await admin(`CREATE DATABASE ${name}`);
  created.push(name);
  return urlFor(name);
}
async function runSql(url, sql) {
  const {Client} = require('pg');
  const client = new Client(url);
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
}
// Cambia la conexión de Sequelize a otra base de prueba.
async function useDatabase(url) {
  await require('../database/models').close();
  process.env.DATABASE_URL = url;
}

before(async () => { if (adminUrl) process.env.NODE_ENV = 'test'; });
after(async () => {
  if (!adminUrl) return;
  await require('../database/models').close();
  for (const name of created) await admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
});

test('structure.sql y data.sql crean y pueblan la base; los modelos la leen igual que el catálogo', {skip}, async () => {
  const url = await newDatabase();
  const structure = fs.readFileSync(path.join(root, 'database', 'structure.sql'), 'utf8')
    .split('\n').filter(line => !/^(DROP DATABASE|CREATE DATABASE|\\connect)/.test(line)).join('\n');
  await runSql(url, structure);
  await runSql(url, fs.readFileSync(path.join(root, 'database', 'data.sql'), 'utf8'));

  await useDatabase(url);
  await require('../database/setup').initialize(); // no debe duplicar ni recargar datos
  const products = require('../database/repositories/products');
  const all = await products.all();
  assert.equal(all.length, catalog.length);
  for (const original of catalog) {
    const row = all.find(p => p.id === original.id);
    assert.ok(row, `falta ${original.id}`);
    assert.equal(row.precio, original.precio, `${original.id} precio`);
    assert.deepEqual(row.tallas, original.tallas, `${original.id} tallas`);
    assert.deepEqual(row.colores, original.colores, `${original.id} colores`);
    assert.equal(row.categoria, original.categoria);
  }
  const users = require('../database/repositories/users');
  assert.ok(await users.authenticate('andrea.demo@example.test', 'VisagDemo-2026'), 'usuario demo de data.sql');
});

test('CRUD de productos y usuarios con Sequelize', {skip}, async () => {
  await useDatabase(await newDatabase());
  await require('../database/setup').initialize();
  const products = require('../database/repositories/products');
  const users = require('../database/repositories/users');
  assert.equal((await products.all()).length, catalog.length, 'la base vacía se llena con el catálogo');

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const made = await products.create({nombre: 'Gorra de prueba', descripcion: 'Creada por la prueba', categoria: 'Gorras', precio: '50000', tallas: 'M, L', colores: 'Negro', imageData: png});
  assert.equal(made.id, 'p109');
  assert.deepEqual([made.precio, made.tallas, made.colores], [50000, ['M', 'L'], ['Negro']]);
  const edited = await products.update(made.id, {nombre: 'Gorra editada', categoria: 'Gorras', precio: '', tallas: 'L', colores: ''});
  assert.deepEqual([edited.nombre, edited.precio, edited.tallas, edited.colores], ['Gorra editada', null, ['L'], []]);
  assert.deepEqual((await products.search({q: 'editada'})).map(p => p.id), [made.id]);
  assert.equal((await products.search({q: 'nike', categoria: 'Zapatos'})).length, 6);
  await assert.rejects(products.update(made.id, {nombre: 'Gorra', categoria: 'No existe'}), /Categoría no válida/);
  assert.equal((await products.remove(made.id)).id, made.id);
  assert.equal(await products.find(made.id), null);
  const again = await products.create({nombre: 'Otra gorra', categoria: 'Gorras', imageData: png});
  assert.equal(again.id, 'p110', 'no reutiliza la referencia eliminada');

  const user = await users.register({firstName: 'Ana', lastName: 'Prueba', email: 'Ana@Example.test', password: 'clave-segura-1'});
  assert.equal(user.email, 'ana@example.test');
  await assert.rejects(users.register({firstName: 'Ana', lastName: 'Otra', email: 'ana@example.test', password: 'clave-segura-1'}), /Ya existe/);
  assert.equal((await users.updateProfile(user.id, {firstName: 'Ana M.', lastName: 'Prueba', email: 'ana@example.test', phone: '3001234567'})).phone, '3001234567');
  await users.changePassword(user.id, 'clave-segura-1', 'clave-segura-2', 'clave-segura-2');
  assert.equal(await users.authenticate('ana@example.test', 'clave-segura-1'), null);
  assert.equal((await users.authenticate('ana@example.test', 'clave-segura-2')).firstName, 'Ana M.');
});

test('migra los datos del esquema anterior (tablas visag_*) sin perder nada', {skip}, async () => {
  const url = await newDatabase();
  const password = 'clave-antigua-1';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  const uploadId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update('token-viejo').digest('hex');
  await runSql(url, `
    CREATE TABLE visag_products (id TEXT PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE visag_users (id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE visag_sessions (token_hash CHAR(64) PRIMARY KEY, user_id UUID NOT NULL REFERENCES visag_users(id), remember BOOLEAN NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE visag_uploads (id UUID PRIMARY KEY, mime TEXT NOT NULL, image_bytes BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE SEQUENCE visag_product_id_seq START WITH 1;
    SELECT setval('visag_product_id_seq', 205, true);
    INSERT INTO visag_uploads VALUES ('${uploadId}', 'image/png', '\\x89504e470d0a1a0a0000', NOW());
    INSERT INTO visag_products (id, payload) VALUES
      ('p001', '{"id":"p001","nombre":"Gorra vieja","categoria":"Gorras","precio":45000,"tallas":["Ajustable"],"colores":[],"imagen":"/img/p001.jpg"}'),
      ('p200', '{"id":"p200","nombre":"Subida desde el panel","descripcion":"con foto","categoria":"Zapatos","precio":null,"tallas":["40","41"],"colores":["Blanco"],"imagen":"/img/uploads/${uploadId}.png"}');
    INSERT INTO visag_users (id, email, payload) VALUES ('${userId}', 'viejo@example.test',
      '{"id":"${userId}","firstName":"Cliente","lastName":"Antiguo","email":"viejo@example.test","phone":"3000000000","password":"${hash}","category":"customer","createdAt":"2026-01-02T03:04:05.000Z"}');
    INSERT INTO visag_sessions VALUES ('${tokenHash}', '${userId}', TRUE, NOW() + INTERVAL '1 day', NOW());
  `);

  await useDatabase(url);
  const setup = require('../database/setup');
  await setup.initialize();
  await setup.initialize(); // reiniciar no duplica nada
  const products = require('../database/repositories/products');
  const repoUsers = require('../database/repositories/users');
  const db = require('../database/models');
  const all = await products.all();
  assert.deepEqual(all.map(p => p.id).sort(), ['p001', 'p200']);
  assert.deepEqual(await products.find('p200'), {id: 'p200', nombre: 'Subida desde el panel', descripcion: 'con foto', categoria: 'Zapatos', precio: null, tallas: ['40', '41'], colores: ['Blanco'], imagen: `/img/uploads/${uploadId}.png`});
  assert.equal((await products.image(uploadId)).mime, 'image/png');
  const migrated = await repoUsers.authenticate('viejo@example.test', password);
  assert.equal(migrated?.id, userId, 'la contraseña anterior sigue sirviendo');
  assert.equal(migrated.createdAt, '2026-01-02T03:04:05.000Z');
  assert.equal(await db.models.Session.count({where: {tokenHash}}), 1, 'la sesión activa se conserva');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.equal((await products.create({nombre: 'Después de migrar', categoria: 'Gorras', imageData: png})).id, 'p206', 'continúa el contador anterior');
  const [{count}] = await db.models.sequelize.query('SELECT COUNT(*)::int AS count FROM visag_products', {type: 'SELECT'});
  assert.equal(count, 2, 'las tablas anteriores quedan intactas como respaldo');
});
