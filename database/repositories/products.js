'use strict';
// CRUD de productos con Sequelize. Devuelve objetos con las mismas claves que
// usan las vistas y el navegador (id, nombre, categoria, precio, tallas...),
// así el resto de la aplicación no depende de cómo se guardan los datos.
const crypto = require('node:crypto');
const {Op} = require('sequelize');
const db = require('../models');
const local = require('../../models/productModel');

const categories = local.categories;
const MAX_BYTES = 3 * 1024 * 1024;
const mimeTypes = {jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif'};
const extensions = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'};

function decodeImage(data) {
  if (typeof data !== 'string' || data.length > Math.ceil(MAX_BYTES * 4 / 3) + 100) throw new Error('Fotografía inválida o mayor a 3 MB.');
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if (!match) throw new Error('Usa una imagen JPG, PNG, WebP o GIF.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 12 || bytes.length > MAX_BYTES) throw new Error('Foto inválida o mayor a 3 MB.');
  const signatures = {
    jpeg: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    png: bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
    gif: ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))
  };
  if (!signatures[match[1]]) throw new Error('El archivo no coincide con su tipo de imagen.');
  return {bytes, mime: mimeTypes[match[1]]};
}

const include = () => {
  const {Category, Size, Color} = db.models;
  return [
    {model: Category, as: 'category', attributes: ['name']},
    {model: Size, as: 'sizes', attributes: ['name'], through: {attributes: ['position']}},
    {model: Color, as: 'colors', attributes: ['name'], through: {attributes: ['position']}}
  ];
};

const byPosition = (list, through) => [...(list || [])]
  .sort((a, b) => (a[through]?.position ?? 0) - (b[through]?.position ?? 0))
  .map(item => item.name);

function toPlain(product) {
  if (!product) return null;
  return {
    id: product.id,
    nombre: product.name,
    descripcion: product.description,
    categoria: product.category?.name || '',
    precio: product.price,
    tallas: byPosition(product.sizes, 'ProductSize'),
    colores: byPosition(product.colors, 'ProductColor'),
    imagen: product.image
  };
}

async function all() {
  const rows = await db.models.Product.findAll({include: include(), order: [['createdAt', 'DESC'], ['id', 'DESC']]});
  return rows.map(toPlain);
}

async function find(id) {
  if (typeof id !== 'string' || !/^p\d{3,}$/.test(id)) return null;
  return toPlain(await db.models.Product.findByPk(id, {include: include()}));
}

// Búsqueda por texto en nombre, descripción o categoría, con filtro opcional de categoría.
async function search({q = '', categoria = ''} = {}) {
  const {Product, Category} = db.models;
  const text = String(q).trim().slice(0, 80);
  const where = {};
  if (text) {
    const like = {[Op.iLike]: `%${text.replace(/[\\%_]/g, c => '\\' + c)}%`};
    where[Op.or] = [{name: like}, {description: like}, {'$category.name$': like}];
  }
  const categoryWhere = categories.includes(categoria) ? {name: categoria} : undefined;
  const ids = await Product.findAll({
    attributes: ['id'],
    where,
    include: [{model: Category, as: 'category', attributes: [], where: categoryWhere}],
    raw: true
  });
  if (!ids.length) return [];
  const rows = await Product.findAll({where: {id: ids.map(r => r.id)}, include: include(), order: [['createdAt', 'DESC'], ['id', 'DESC']]});
  return rows.map(toPlain);
}

// Busca o crea las filas de una tabla secundaria (tallas o colores) y devuelve sus ids en orden.
async function namesToIds(Model, names, transaction) {
  const ids = [];
  for (const name of names) {
    const [row] = await Model.findOrCreate({where: {name}, defaults: {name}, transaction});
    ids.push(row.id);
  }
  return ids;
}

async function setRelations(product, fields, transaction) {
  const {Size, Color, ProductSize, ProductColor} = db.models;
  const sizeIds = await namesToIds(Size, fields.tallas, transaction);
  const colorIds = await namesToIds(Color, fields.colores, transaction);
  await ProductSize.destroy({where: {productId: product.id}, transaction});
  await ProductColor.destroy({where: {productId: product.id}, transaction});
  if (sizeIds.length) await ProductSize.bulkCreate(sizeIds.map((sizeId, position) => ({productId: product.id, sizeId, position})), {transaction});
  if (colorIds.length) await ProductColor.bulkCreate(colorIds.map((colorId, position) => ({productId: product.id, colorId, position})), {transaction});
}

async function categoryId(name, transaction) {
  const row = await db.models.Category.findOne({where: {name}, transaction});
  if (!row) throw new Error('Categoría no válida.');
  return row.id;
}

async function saveUpload(imageData, transaction) {
  const image = decodeImage(imageData);
  const row = await db.models.Upload.create({id: crypto.randomUUID(), mime: image.mime, data: image.bytes}, {transaction});
  return {uploadId: row.id, image: `/img/uploads/${row.id}.${extensions[image.mime]}`};
}

async function create(input) {
  const fields = local.validate(input, null);
  if (!input.imageData) throw new Error('Selecciona una fotografía para el nuevo producto.');
  decodeImage(input.imageData); // validar antes de abrir la transacción
  const {sequelize, Product} = db.models;
  const id = await sequelize.transaction(async transaction => {
    const [{n}] = await sequelize.query("SELECT nextval('product_number_seq') AS n", {type: sequelize.QueryTypes.SELECT, transaction});
    const productId = `p${String(n).padStart(3, '0')}`;
    const photo = await saveUpload(input.imageData, transaction);
    const product = await Product.create({
      id: productId, name: fields.nombre, description: fields.descripcion, price: fields.precio,
      categoryId: await categoryId(fields.categoria, transaction), ...photo
    }, {transaction});
    await setRelations(product, fields, transaction);
    return productId;
  });
  return find(id);
}

async function update(id, input) {
  const {sequelize, Product, Upload} = db.models;
  const done = await sequelize.transaction(async transaction => {
    const product = await Product.findByPk(id, {transaction, lock: transaction.LOCK.UPDATE});
    if (!product) return false;
    const previous = await find(id);
    const fields = local.validate(input, previous);
    if (input.imageData) decodeImage(input.imageData);
    const oldUploadId = product.uploadId;
    const changes = {name: fields.nombre, description: fields.descripcion, price: fields.precio, categoryId: await categoryId(fields.categoria, transaction)};
    if (input.imageData) Object.assign(changes, await saveUpload(input.imageData, transaction));
    await product.update(changes, {transaction});
    await setRelations(product, fields, transaction);
    if (input.imageData && oldUploadId) await Upload.destroy({where: {id: oldUploadId}, transaction});
    return true;
  });
  return done ? find(id) : null;
}

async function remove(id) {
  const {sequelize, Product, Upload} = db.models;
  const previous = await find(id);
  if (!previous) return null;
  await sequelize.transaction(async transaction => {
    const product = await Product.findByPk(id, {transaction, lock: transaction.LOCK.UPDATE});
    if (!product) return;
    const uploadId = product.uploadId;
    await product.destroy({transaction}); // product_sizes y product_colors se borran en cascada
    if (uploadId) await Upload.destroy({where: {id: uploadId}, transaction});
  });
  return previous;
}

// Inserta un producto ya existente (semilla JSON o migración) conservando su referencia.
async function importProduct(plain, {createdAt, uploadId = null} = {}, transaction) {
  const {Product, Category} = db.models;
  const [category] = await Category.findOrCreate({where: {name: plain.categoria}, defaults: {name: plain.categoria}, transaction});
  const product = await Product.create({
    id: plain.id, name: plain.nombre, description: plain.descripcion || '',
    price: Number.isSafeInteger(plain.precio) ? plain.precio : null,
    image: plain.imagen, categoryId: category.id, uploadId,
    ...(createdAt ? {createdAt, updatedAt: createdAt} : {})
  }, {transaction, silent: Boolean(createdAt), validate: false});
  await setRelations(product, {tallas: plain.tallas || [], colores: plain.colores || []}, transaction);
}

// Cambia solo el precio y/o las tallas (lo usa scripts/importCatalog.js).
async function patch(id, {precio, tallas}) {
  const {sequelize, Product} = db.models;
  return sequelize.transaction(async transaction => {
    const product = await Product.findByPk(id, {transaction, lock: transaction.LOCK.UPDATE});
    if (!product) return false;
    if (precio !== undefined) await product.update({price: precio}, {transaction});
    if (tallas !== undefined) {
      const current = await find(id);
      await setRelations(product, {tallas, colores: current.colores}, transaction);
    }
    return true;
  });
}

async function image(id) {
  const row = await db.models.Upload.findByPk(id, {attributes: ['mime', 'data']});
  return row ? {mime: row.mime, image_bytes: row.data} : null;
}

module.exports = {all, find, search, create, update, remove, image, patch, importProduct, categories, decodeImage, toPlain};
