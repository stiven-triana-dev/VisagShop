'use strict';
// Completa precios y tallas del catálogo a partir de data/completar-catalogo.csv.
//
//   npm run catalog:import            -> solo muestra los cambios (no escribe nada)
//   npm run catalog:import -- --aplicar -> guarda en data/products.json y, si existe
//                                         DATABASE_URL, también en la base de datos
// Con DATABASE_URL los cambios se comparan con lo que hay en la base (lo que ve la tienda).
//
// Columnas: id;categoria;nombre;precio;tallas;foto. Solo se usan id, precio y tallas.
// Una celda vacía deja el dato actual sin cambios. Las tallas se separan con comas.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const seedFile = path.join(root, 'data', 'products.json');
const defaultCsv = path.join(root, 'data', 'completar-catalogo.csv');

function parsePrice(raw, id) {
  const text = String(raw || '').trim();
  if (!text) return undefined;
  // Acepta 130000, 130.000, $130.000 o 130 000 (pesos colombianos, sin centavos).
  const clean = text.replace(/[$\s.]/g, '');
  if (!/^\d+$/.test(clean)) throw new Error(`${id}: precio "${text}" no es un número entero en pesos.`);
  const value = Number(clean);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 999999999) throw new Error(`${id}: precio "${text}" fuera de rango.`);
  return value;
}

function parseSizes(raw) {
  const text = String(raw || '').trim();
  if (!text) return undefined;
  return [...new Set(text.split(',').map(s => s.trim().slice(0, 25)).filter(Boolean))].slice(0, 30);
}

function unquote(cell) {
  const t = cell.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/""/g, '"') : t;
}

// Devuelve [{id, precio?, tallas?}] solo con los campos que traen valor.
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => unquote(h).toLowerCase());
  const col = name => header.indexOf(name);
  if (col('id') < 0 || col('precio') < 0 || col('tallas') < 0) throw new Error('El CSV debe tener las columnas id, precio y tallas.');
  const changes = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(sep).map(unquote);
    const id = cells[col('id')];
    if (!id) continue;
    if (!/^p\d{3,}$/.test(id)) throw new Error(`Referencia inválida: "${id}".`);
    const change = {id};
    const precio = parsePrice(cells[col('precio')], id);
    const tallas = parseSizes(cells[col('tallas')]);
    if (precio !== undefined) change.precio = precio;
    if (tallas !== undefined) change.tallas = tallas;
    if (Object.keys(change).length > 1) changes.push(change);
  }
  return changes;
}

// Aplica los cambios sobre la lista y devuelve solo los que modifican algo.
function applyChanges(products, changes) {
  const byId = new Map(products.map(p => [p.id, p]));
  const applied = [];
  for (const {id, ...fields} of changes) {
    const product = byId.get(id);
    if (!product) throw new Error(`${id} no existe en el catálogo.`);
    const diff = {};
    if ('precio' in fields && fields.precio !== product.precio) diff.precio = fields.precio;
    if ('tallas' in fields && JSON.stringify(fields.tallas) !== JSON.stringify(product.tallas || [])) diff.tallas = fields.tallas;
    if (Object.keys(diff).length) {
      applied.push({id, nombre: product.nombre, before: {precio: product.precio, tallas: product.tallas || []}, diff});
      Object.assign(product, diff);
    }
  }
  return applied;
}

// Actualiza la base de datos (Sequelize). Si las tablas aún no existen, las crea
// y copia los datos anteriores igual que al arrancar la tienda.
async function updateNeon(applied) {
  const setup = require('../database/setup');
  const products = require('../database/repositories/products');
  const missing = [];
  await setup.initialize();
  for (const {id, diff} of applied) {
    if (!await products.patch(id, diff)) missing.push(id);
  }
  return missing;
}

// Con DATABASE_URL los cambios se calculan contra la base (lo que ve la tienda);
// sin ella, contra data/products.json.
async function currentCatalog(apply) {
  if (!process.env.DATABASE_URL) return JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const db = require('../database/models');
  if (apply) await require('../database/setup').initialize();
  try {
    return await require('../database/repositories/products').all();
  } catch (error) {
    if (/relation .* does not exist/.test(error.message)) {
      throw new Error('La base todavía usa el esquema anterior. Despliega la versión nueva (o ejecuta con --aplicar) y repite.');
    }
    throw error;
  } finally {
    if (!apply) await db.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--aplicar');
  const csvFile = path.resolve(args.find(a => !a.startsWith('--')) || defaultCsv);
  const products = await currentCatalog(apply);
  const known = new Set(products.map(p => p.id));
  const changes = parseCsv(fs.readFileSync(csvFile, 'utf8'));
  const unknown = changes.filter(c => !known.has(c.id)).map(c => c.id);
  if (unknown.length) console.log(`No existen en el catálogo (se omiten): ${unknown.join(', ')}`);
  const applied = applyChanges(products, changes.filter(c => known.has(c.id)));

  const money = v => (v == null ? 'sin precio' : '$' + v.toLocaleString('es-CO'));
  for (const {id, nombre, before, diff} of applied) {
    const parts = [];
    if (diff.precio !== undefined) parts.push(`precio ${money(before.precio)} → ${money(diff.precio)}`);
    if (diff.tallas) parts.push(`tallas [${before.tallas.join(', ') || '—'}] → [${diff.tallas.join(', ')}]`);
    console.log(`${id}  ${nombre}: ${parts.join('; ')}`);
  }
  const pendingPrice = products.filter(p => !p.precio).length;
  const pendingSizes = products.filter(p => !p.tallas || !p.tallas.length).length;
  console.log(`\n${applied.length} productos con cambios. Tras aplicarlos quedarían ${pendingPrice} sin precio y ${pendingSizes} sin tallas.`);

  if (!apply) {
    console.log('Vista previa: no se guardó nada. Ejecuta con --aplicar para guardar.');
    return;
  }
  // Base de datos primero: si falla, el JSON queda igual y se puede repetir el comando.
  if (process.env.DATABASE_URL) {
    try {
      if (applied.length) {
        const missing = await updateNeon(applied);
        console.log(`Actualizado en la base de datos (${applied.length - missing.length} productos).`);
      }
    } finally {
      await require('../database/models').close();
    }
    // Mantener también la semilla JSON al día.
    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const seedIds = new Set(seed.map(p => p.id));
    if (applyChanges(seed, changes.filter(c => seedIds.has(c.id))).length) {
      fs.writeFileSync(seedFile, JSON.stringify(seed, null, 1));
      console.log('Guardado también en data/products.json.');
    }
    return;
  }
  if (!applied.length) return;
  console.log('Sin DATABASE_URL: la tienda publicada en Render no se modificó.');
  fs.writeFileSync(seedFile, JSON.stringify(products, null, 1));
  console.log('Guardado en data/products.json.');
}

if (require.main === module) {
  main().catch(error => { console.error('No se importó nada:', error.message); process.exitCode = 1; });
}
module.exports = {parseCsv, parsePrice, parseSizes, applyChanges};
