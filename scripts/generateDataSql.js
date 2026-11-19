'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
const {categories} = require('../models/productModel');

const DEMO_PASSWORD = 'VisagDemo-2026';
const demoUsers = [
  {id: '2b0c6a0e-6d1f-4c1a-9a7e-0d6f0a1b2c01', firstName: 'Andrea', lastName: 'Rojas', email: 'andrea.demo@example.test', phone: '+57 300 000 0001'},
  {id: '2b0c6a0e-6d1f-4c1a-9a7e-0d6f0a1b2c02', firstName: 'Mateo', lastName: 'López', email: 'mateo.demo@example.test', phone: ''}
];

const sql = value => value === null || value === undefined ? 'NULL'
  : typeof value === 'number' ? String(value)
  : `'${String(value).replace(/'/g, "''")}'`;
const unique = list => [...new Set(list)];
const credential = password => {
  const salt = crypto.createHash('sha256').update('visagshop-demo-salt').digest('hex').slice(0, 32);
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};

const categoryNames = unique([...categories, ...products.map(p => p.categoria)]);
const sizeNames = unique(products.flatMap(p => p.tallas || []));
const colorNames = unique(products.flatMap(p => p.colores || [])).sort((a, b) => a.localeCompare(b, 'es'));
const idOf = list => name => list.indexOf(name) + 1;
const categoryId = idOf(categoryNames), sizeId = idOf(sizeNames), colorId = idOf(colorNames);
const values = rows => rows.map(r => `  (${r.join(', ')})`).join(',\n');
const maxNumber = Math.max(...products.map(p => Number(p.id.slice(1))));

const out = [];
out.push(`BEGIN;
`);
out.push(`INSERT INTO categories (id, name) VALUES\n${values(categoryNames.map((n, i) => [i + 1, sql(n)]))};\n`);
out.push(`INSERT INTO sizes (id, name) VALUES\n${values(sizeNames.map((n, i) => [i + 1, sql(n)]))};\n`);
out.push(`INSERT INTO colors (id, name) VALUES\n${values(colorNames.map((n, i) => [i + 1, sql(n)]))};\n`);
out.push(`INSERT INTO products (id, name, description, price, image, category_id) VALUES\n${values(
  [...products].sort((a, b) => a.id.localeCompare(b.id)).map(p => [sql(p.id), sql(p.nombre), sql(p.descripcion || ''), sql(Number.isSafeInteger(p.precio) ? p.precio : null), sql(p.imagen), categoryId(p.categoria)])
)};\n`);
out.push(`INSERT INTO product_sizes (product_id, size_id, position) VALUES\n${values(
  products.flatMap(p => (p.tallas || []).map((t, i) => [sql(p.id), sizeId(t), i]))
)};\n`);
out.push(`INSERT INTO product_colors (product_id, color_id, position) VALUES\n${values(
  products.flatMap(p => (p.colores || []).map((c, i) => [sql(p.id), colorId(c), i]))
)};\n`);
out.push(`INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role) VALUES\n${values(
  demoUsers.map(u => [sql(u.id), sql(u.firstName), sql(u.lastName), sql(u.email), sql(u.phone), sql(credential(DEMO_PASSWORD)), sql('customer')])
)};\n`);
out.push(`SELECT setval('categories_id_seq', ${categoryNames.length}, true);
SELECT setval('sizes_id_seq', ${sizeNames.length}, true);
SELECT setval('colors_id_seq', ${colorNames.length}, true);
SELECT setval('product_number_seq', ${maxNumber}, true);

COMMIT;
`);

fs.writeFileSync(path.join(root, 'database', 'data.sql'), out.join('\n'));
console.log(`database/data.sql: ${categoryNames.length} categorías, ${sizeNames.length} tallas, ${colorNames.length} colores, ${products.length} productos, ${demoUsers.length} usuarios.`);
