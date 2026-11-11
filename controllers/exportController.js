'use strict';
// Descargas del panel: pedidos en CSV (se abre en Excel) y una copia de los datos en JSON.
const orders = require('../models/activeOrders');
const products = require('../models/activeProducts');
const users = require('../models/activeUsers');

const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bogota'}).format(new Date()); // AAAA-MM-DD
const localDate = iso => new Intl.DateTimeFormat('es-CO', {dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota'}).format(new Date(iso));

// Celda CSV segura: comillas escapadas y sin fórmulas (un valor que empieza con
// = + - @ podría ejecutarse en Excel, así que se antepone un apóstrofo).
function cell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function ordersCsv(req, res) {
  const status = orders.STATUSES.includes(req.query.estado) ? req.query.estado : '';
  const list = (await orders.exportAll()).filter(o => !status || o.status === status);
  const header = ['Pedido', 'Fecha', 'Estado', 'Nombre', 'Apellido', 'Celular', 'Correo', 'Documento', 'Departamento', 'Ciudad', 'Dirección', 'Complemento', 'Código postal', 'Facturación', 'Pago', 'Prendas', 'Unidades', 'Total productos (COP)', 'Precio por confirmar', 'Nota interna'];
  const rows = list.map(o => [
    o.code, localDate(o.createdAt), o.statusLabel, o.customer.firstName, o.customer.lastName, o.customer.phone,
    o.customer.email, o.customer.document, o.shipping.department, o.shipping.city, o.shipping.address,
    o.shipping.addressExtra, o.shipping.postalCode, o.billingAddress || 'Misma de entrega', o.paymentLabel,
    o.items.map(i => `${i.quantity} x ${i.name}${i.size ? ` (${i.size})` : ''}`).join(' | '),
    o.itemCount, o.subtotal, o.hasUnpriced ? 'Sí' : 'No', o.adminNote
  ]);
  // Punto y coma y BOM: así Excel en español separa bien las columnas y muestra las tildes.
  const csv = '﻿' + [header, ...rows].map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
  res.set('Cache-Control', 'no-store');
  res.attachment(`visagshop-pedidos${status ? '-' + status : ''}-${today()}.csv`);
  res.type('text/csv; charset=utf-8').send(csv);
}

async function backupJson(req, res) {
  const data = {
    tienda: 'VisagShop',
    generado: new Date().toISOString(),
    nota: 'Copia de productos, pedidos y clientes. No incluye contraseñas ni sesiones.',
    productos: await products.all(),
    pedidos: await orders.exportAll(),
    clientes: await users.exportAll()
  };
  res.set('Cache-Control', 'no-store');
  res.attachment(`visagshop-respaldo-${today()}.json`);
  res.type('application/json').send(JSON.stringify(data, null, 2));
}

module.exports = {ordersCsv, backupJson, cell};
