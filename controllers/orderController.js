'use strict';
const orders = require('../models/activeOrders');

// POST /api/orders — guarda el pedido del carrito y devuelve su número.
async function create(req, res) {
  try {
    const order = await orders.create(req.body, req.customer?.id || null);
    return res.status(201).json({ok: true, number: order.number, code: order.code, subtotal: order.subtotal, hasUnpriced: order.hasUnpriced, mine: Boolean(req.customer)});
  } catch (error) {
    if (error.code || error.name?.startsWith('Sequelize')) {
      console.error('Pedido:', error.message);
      return res.status(503).json({ok: false, error: 'No pudimos registrar el pedido. Puedes enviarlo igual por WhatsApp.'});
    }
    return res.status(400).json({ok: false, error: error.message});
  }
}

// ----- Panel de administración -----
const pageData = extra => ({pageTitle: 'Pedidos | VisagShop', isAdmin: true, statuses: orders.STATUSES, statusLabels: orders.STATUS_LABELS, ...extra});
const money = value => new Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}).format(value);
const date = iso => new Intl.DateTimeFormat('es-CO', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota'}).format(new Date(iso));

async function list(req, res) {
  const status = orders.STATUSES.includes(req.query.estado) ? req.query.estado : '';
  const page = Number.parseInt(req.query.page, 10) || 1;
  const result = await orders.list({status, page});
  res.render('admin/orders', pageData({...result, status, money, date}));
}

async function detail(req, res) {
  const order = await orders.find(req.params.number);
  if (!order) return res.status(404).render('404', {pageTitle: 'Pedido no encontrado | VisagShop'});
  res.render('admin/orderDetail', pageData({pageTitle: `Pedido ${order.code} | VisagShop`, order, money, date, pageScript: 'adminOrder.js'}));
}

async function updateStatus(req, res) {
  const order = await orders.updateStatus(req.params.number, req.body.status, req.body.adminNote);
  if (!order) return res.status(404).json({ok: false, error: 'Pedido no encontrado.'});
  return res.json({ok: true, status: order.status, statusLabel: order.statusLabel, message: `Pedido ${order.code} actualizado a «${order.statusLabel}».`});
}

module.exports = {create, list, detail, updateStatus, money, date};
