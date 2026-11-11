'use strict';
// Pedidos: lógica común y almacenamiento en JSON para desarrollo local
// (sin DATABASE_URL). database/repositories/orders.js tiene la misma interfaz.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STATUSES = ['nuevo', 'confirmado', 'enviado', 'entregado', 'cancelado'];
const STATUS_LABELS = {nuevo: 'Nuevo', confirmado: 'Confirmado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado'};
const PAYMENTS = ['contraentrega', 'nequi', 'tarjeta'];
const PAYMENT_LABELS = {contraentrega: 'Contraentrega', nequi: 'Nequi (pago anticipado)', tarjeta: 'Tarjeta (enlace de pago)'};
const FIRST_NUMBER = 1001;
const PAGE_SIZE = 20;

const code = number => `VS-${number}`;
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Arma el pedido a partir del formulario y del catálogo. Los precios siempre salen
// del catálogo del servidor, nunca de lo que envía el navegador.
async function buildOrder(input, findProduct) {
  const items = [];
  for (const [position, line] of (input.items || []).entries()) {
    const product = await findProduct(line.id);
    if (!product) throw new Error(`El producto ${line.id} ya no está disponible. Actualiza tu carrito.`);
    items.push({
      productId: product.id, name: product.nombre, image: product.imagen,
      size: text(line.talla, 50), quantity: Number(line.cant),
      unitPrice: Number.isSafeInteger(product.precio) ? product.precio : null, position
    });
  }
  if (!items.length) throw new Error('Tu carrito está vacío.');
  const different = input.facturacion === 'diferente';
  return {
    customer: {
      firstName: text(input.nombre, 65), lastName: text(input.apellidos, 65), phone: text(input.celular, 22),
      email: text(input.email, 120).toLowerCase(), document: text(input.documento, 20)
    },
    shipping: {
      department: text(input.departamento, 70), city: text(input.ciudad, 70), address: text(input.direccion, 140),
      addressExtra: text(input.complemento, 140), postalCode: text(input.postal, 12)
    },
    billingAddress: different ? [input.fact_direccion, input.fact_ciudad, input.fact_departamento].map(v => text(v, 140)).filter(Boolean).join(', ').slice(0, 300) : '',
    paymentMethod: PAYMENTS.includes(input['medio-pago']) ? input['medio-pago'] : 'contraentrega',
    subtotal: items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0),
    hasUnpriced: items.some(i => i.unitPrice === null),
    items
  };
}

// Completa los campos calculados que usan las vistas.
function decorate(order) {
  if (!order) return null;
  return {
    ...order,
    code: code(order.number),
    statusLabel: STATUS_LABELS[order.status] || order.status,
    paymentLabel: PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod,
    itemCount: order.items ? order.items.reduce((n, i) => n + i.quantity, 0) : order.itemCount,
    items: order.items?.map(i => ({...i, lineTotal: i.unitPrice === null ? null : i.unitPrice * i.quantity}))
  };
}

// ----- Almacenamiento JSON (desarrollo local) -----
const dataDir = path.resolve(process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data'));
const file = path.join(dataDir, 'orders.json');
function read() {
  try { const rows = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(rows) ? rows : []; }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function write(rows) {
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(rows, null, 2) + '\n', {mode: 0o600}); fs.renameSync(tmp, file); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

async function create(input, userId = null) {
  const products = require('./productModel');
  const built = await buildOrder(input, async id => products.find(id));
  const rows = read();
  const now = new Date().toISOString();
  const order = {
    id: crypto.randomUUID(), number: Math.max(FIRST_NUMBER - 1, ...rows.map(r => r.number)) + 1,
    userId, status: 'nuevo', adminNote: '', createdAt: now, updatedAt: now, ...built
  };
  rows.push(order);
  write(rows);
  return decorate(order);
}

async function list({status = '', page = 1} = {}) {
  const all = read().sort((a, b) => b.number - a.number);
  const filtered = STATUSES.includes(status) ? all.filter(o => o.status === status) : all;
  const counts = Object.fromEntries(STATUSES.map(s => [s, all.filter(o => o.status === s).length]));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, page));
  return {orders: filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(decorate), total: filtered.length, all: all.length, counts, page: current, pages};
}

async function find(number) { return decorate(read().find(o => o.number === Number(number)) || null); }

async function listByUser(userId) {
  return read().filter(o => o.userId && o.userId === userId).sort((a, b) => b.number - a.number).map(decorate);
}

async function updateStatus(number, status, adminNote) {
  const rows = read();
  const order = rows.find(o => o.number === Number(number));
  if (!order) return null;
  order.status = status;
  order.adminNote = text(adminNote, 500);
  order.updatedAt = new Date().toISOString();
  write(rows);
  return decorate(order);
}

module.exports = {
  STATUSES, STATUS_LABELS, PAYMENTS, PAYMENT_LABELS, FIRST_NUMBER, PAGE_SIZE,
  code, buildOrder, decorate, create, list, find, listByUser, updateStatus
};
