'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sourceDir = path.join(__dirname, 'data');
const dataDir = path.resolve(
  process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || sourceDir,
);
const persistent = dataDir !== sourceDir;
const uploadDir = persistent
  ? path.join(dataDir, 'uploads')
  : path.join(__dirname, 'public', 'img', 'uploads');
const manifestFile = path.join(dataDir, '.visagshop-storage.json');

function setup() {
  if (process.env.NODE_ENV === 'production' && !persistent) {
    throw new Error(
      'Arranque bloqueado: configura un volumen Railway /data (RAILWAY_VOLUME_MOUNT_PATH) o VISAG_DATA_DIR. Los JSON no deben guardarse en el contenedor efímero.',
    );
  }
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  if (!persistent) {
    for (const name of ['users.json', 'sessions.json']) {
      const target = path.join(dataDir, name);
      if (!fs.existsSync(target)) fs.writeFileSync(target, '[]\n', { flag: 'wx', mode: 0o600 });
    }
    return { dataDir, uploadDir, persistent };
  }
  const files = ['products.json', 'users.json', 'sessions.json', 'product-sequence.json'];
  const current = files.filter((name) => fs.existsSync(path.join(dataDir, name)));
  const initialized = fs.existsSync(manifestFile);
  if (initialized && current.length !== files.length) {
    throw new Error(
      `Volumen incompleto: faltan ${files.filter((n) => !current.includes(n)).join(', ')}. No se reinicializarán datos de clientes. Restaura una copia.`,
    );
  }
  if (!initialized && current.length) {
    throw new Error(
      'Hay datos previos sin manifiesto en el volumen. Revisa o restaura los archivos antes de iniciar.',
    );
  }
  if (!initialized) {
    const sourceProducts = path.join(sourceDir, 'products.json');
    const products = JSON.parse(fs.readFileSync(sourceProducts, 'utf8'));
    if (!Array.isArray(products) || products.length === 0) throw new Error('Catálogo inicial inválido.');
    const maxId = Math.max(0, ...products.map((p) => Number(/^p(\d+)$/.exec(p.id)?.[1] || 0)));
    const start = {
      'products.json': JSON.stringify(products, null, 2) + '\n',
      'users.json': '[]\n',
      'sessions.json': '[]\n',
      'product-sequence.json': JSON.stringify({ lastNumber: maxId }) + '\n',
    };
    for (const [name, contents] of Object.entries(start))
      fs.writeFileSync(path.join(dataDir, name), contents, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(
      manifestFile,
      JSON.stringify(
        {
          application: 'visagshop',
          format: 1,
          initializedAt: new Date().toISOString(),
          id: crypto.randomUUID(),
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.info('Se creó el almacén persistente por primera vez, con catálogo original y usuarios vacíos.');
  }
  for (const name of files) {
    const obj = JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
    if (name !== 'product-sequence.json' && !Array.isArray(obj))
      throw new Error(`Archivo de datos ${name} inválido.`);
  }
  return { dataDir, uploadDir, persistent };
}
module.exports = { dataDir, uploadDir, persistent, setup };
