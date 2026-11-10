'use strict';
// Preparación de la base de datos al arrancar la aplicación:
//  1. Crea las tablas que falten a partir de los modelos (sync sin "alter":
//     nunca modifica ni borra tablas existentes).
//  2. Si la base estaba vacía, copia los datos del esquema anterior (Sprint 5:
//     tablas visag_*) o, si no existe, carga el catálogo de data/products.json.
//     Las tablas visag_* no se borran: quedan como respaldo.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./models');
const products = require('./repositories/products');

const LOCK_ID = 712381530;

async function legacyTable(name, transaction) {
  const [row] = await db.models.sequelize.query('SELECT to_regclass(:name) AS t', {replacements: {name: `public.${name}`}, type: 'SELECT', transaction});
  return Boolean(row?.t);
}

async function migrateLegacyCatalog(transaction) {
  const {sequelize, Upload} = db.models;
  const q = (sql, replacements) => sequelize.query(sql, {replacements, type: 'SELECT', transaction});
  if (await legacyTable('visag_uploads', transaction)) {
    for (const row of await q('SELECT id, mime, image_bytes, created_at FROM visag_uploads')) {
      await Upload.create({id: row.id, mime: row.mime, data: row.image_bytes, createdAt: row.created_at, updatedAt: row.created_at}, {transaction, silent: true});
    }
  }
  const rows = await q('SELECT payload, created_at FROM visag_products ORDER BY id');
  for (const {payload, created_at: createdAt} of rows) {
    const uploadId = /^\/img\/uploads\/([a-f0-9-]{36})\./.exec(payload.imagen || '')?.[1] || null;
    await products.importProduct(payload, {createdAt, uploadId}, transaction);
  }
  return rows.length;
}

async function seedCatalog(transaction) {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
  if (!Array.isArray(rows) || !rows.length) throw new Error('No se encontró el catálogo inicial (data/products.json).');
  const createdAt = new Date();
  for (const row of rows) await products.importProduct(row, {createdAt}, transaction);
  return rows.length;
}

async function migrateLegacyAccounts(transaction) {
  const {sequelize, User, Session} = db.models;
  const q = sql => sequelize.query(sql, {type: 'SELECT', transaction});
  const users = await q('SELECT id, payload, created_at FROM visag_users');
  for (const {id, payload: u, created_at: createdAt} of users) {
    await User.create({
      id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '',
      passwordHash: u.password, role: 'customer',
      createdAt: u.createdAt ? new Date(u.createdAt) : createdAt,
      updatedAt: u.updatedAt ? new Date(u.updatedAt) : createdAt
    }, {transaction, silent: true, validate: false});
  }
  let sessions = 0;
  if (users.length && await legacyTable('visag_sessions', transaction)) {
    const rows = await q('SELECT token_hash, user_id, remember, expires_at, created_at FROM visag_sessions WHERE expires_at > NOW()');
    for (const s of rows) {
      await Session.create({tokenHash: s.token_hash, userId: s.user_id, remember: s.remember, expiresAt: s.expires_at, createdAt: s.created_at}, {transaction, silent: true});
    }
    sessions = rows.length;
  }
  return {users: users.length, sessions};
}

// El contador de referencias nunca retrocede: así no se reutiliza el id de un producto eliminado.
async function syncSequence(transaction) {
  const {sequelize} = db.models;
  const q = sql => sequelize.query(sql, {type: 'SELECT', transaction});
  const [{max}] = await q("SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 2) AS INTEGER)), 0) AS max FROM products");
  const [{last}] = await q('SELECT last_value AS last FROM product_number_seq');
  let legacy = 0;
  if (await legacyTable('visag_product_id_seq', transaction)) [{legacy}] = await q('SELECT last_value AS legacy FROM visag_product_id_seq');
  const value = Math.max(Number(max), Number(last), Number(legacy), 1);
  await q(`SELECT setval('product_number_seq', ${value}, true)`);
}

// Ajustes de datos que deben ejecutarse una sola vez; quedan registrados en app_meta.
async function runOnce(key, transaction, task) {
  const {sequelize} = db.models;
  const [done] = await sequelize.query('SELECT 1 FROM app_meta WHERE key = :key', {replacements: {key}, type: 'SELECT', transaction});
  if (done) return;
  const result = await task();
  await sequelize.query('INSERT INTO app_meta (key, value) VALUES (:key, :value)', {replacements: {key, value: JSON.stringify(result ?? {})}, transaction});
}

// Noviembre 2026: el catálogo completó precios, tallas y colores. Se copian a los
// productos que en la base todavía no los tienen. No pisa datos ya cargados y,
// al correr una sola vez, tampoco vuelve a llenar un precio que el administrador
// deje vacío después.
async function fillCatalogGaps(transaction) {
  const {Product, Size, Color} = db.models;
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));
  let prices = 0, sizes = 0, colors = 0;
  for (const item of seed) {
    const row = await Product.findByPk(item.id, {
      transaction,
      include: [{model: Size, as: 'sizes', through: {attributes: ['position']}}, {model: Color, as: 'colors', through: {attributes: ['position']}}]
    });
    if (!row) continue;
    if (row.price === null && Number.isSafeInteger(item.precio)) {
      await row.update({price: item.precio}, {transaction});
      prices++;
    }
    const current = products.toPlain(row);
    const newSizes = !current.tallas.length && item.tallas?.length ? item.tallas : null;
    const newColors = !current.colores.length && item.colores?.length ? item.colores : null;
    if (newSizes || newColors) {
      await products.setRelations(row, {tallas: newSizes || current.tallas, colores: newColors || current.colores}, transaction);
      if (newSizes) sizes++;
      if (newColors) colors++;
    }
  }
  console.info(`Catálogo completado: ${prices} precios, ${sizes} tallas y ${colors} colores agregados.`);
  return {prices, sizes, colors};
}

async function initialize() {
  const {sequelize, Product, User, Category} = db.connect();
  await sequelize.authenticate();
  await sequelize.sync();
  await sequelize.query('CREATE SEQUENCE IF NOT EXISTS product_number_seq START WITH 1');
  await sequelize.query('CREATE TABLE IF NOT EXISTS app_meta (key VARCHAR(80) PRIMARY KEY, value JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await sequelize.transaction(async transaction => {
    await sequelize.query(`SELECT pg_advisory_xact_lock(${LOCK_ID})`, {transaction});
    for (const name of products.categories) await Category.findOrCreate({where: {name}, defaults: {name}, transaction});

    if (await Product.count({transaction}) === 0) {
      if (await legacyTable('visag_products', transaction)) {
        console.info(`Migración: ${await migrateLegacyCatalog(transaction)} productos copiados desde visag_products.`);
      } else {
        console.info(`Catálogo inicial cargado: ${await seedCatalog(transaction)} productos.`);
      }
    }
    if (await User.count({transaction}) === 0 && await legacyTable('visag_users', transaction)) {
      const moved = await migrateLegacyAccounts(transaction);
      console.info(`Migración: ${moved.users} usuarios y ${moved.sessions} sesiones activas copiados.`);
    }
    await runOnce('catalog-fill-2026-11', transaction, () => fillCatalogGaps(transaction));
    await syncSequence(transaction);
  });
}

async function ping() { await db.models.sequelize.query('SELECT 1'); }

module.exports = {initialize, ping};
