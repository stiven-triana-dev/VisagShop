'use strict';
// Pedidos con Sequelize. Misma interfaz que models/orderModel.js.
const db = require('../models');
const products = require('./products');
const common = require('../../models/orderModel');

function toPlain(row) {
  if (!row) return null;
  return common.decorate({
    id: row.id, number: row.number, userId: row.userId, status: row.status, adminNote: row.adminNote,
    createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
    customer: {firstName: row.firstName, lastName: row.lastName, phone: row.phone, email: row.email, document: row.document},
    shipping: {department: row.department, city: row.city, address: row.address, addressExtra: row.addressExtra, postalCode: row.postalCode},
    billingAddress: row.billingAddress, paymentMethod: row.paymentMethod, subtotal: row.subtotal, hasUnpriced: row.hasUnpriced,
    items: row.items ? [...row.items].sort((a, b) => a.position - b.position).map(i => ({
      productId: i.productId, name: i.productName, image: i.image, size: i.size, quantity: i.quantity, unitPrice: i.unitPrice, position: i.position
    })) : undefined,
    itemCount: row.get?.('itemCount') !== undefined ? Number(row.get('itemCount')) : undefined
  });
}

async function create(input, userId = null) {
  const built = await common.buildOrder(input, id => products.find(id));
  const {sequelize, Order, OrderItem} = db.models;
  const id = await sequelize.transaction(async transaction => {
    const [{n}] = await sequelize.query("SELECT nextval('order_number_seq') AS n", {type: 'SELECT', transaction});
    const order = await Order.create({
      number: Number(n), userId, status: 'nuevo',
      ...built.customer, ...built.shipping,
      billingAddress: built.billingAddress, paymentMethod: built.paymentMethod,
      subtotal: built.subtotal, hasUnpriced: built.hasUnpriced
    }, {transaction});
    await OrderItem.bulkCreate(built.items.map(i => ({
      orderId: order.id, productId: i.productId, productName: i.name, image: i.image,
      size: i.size, quantity: i.quantity, unitPrice: i.unitPrice, position: i.position
    })), {transaction});
    return order.id;
  });
  return toPlain(await Order.findByPk(id, {include: [{model: OrderItem, as: 'items'}]}));
}

async function list({status = '', page = 1} = {}) {
  const {sequelize, Order, OrderItem} = db.models;
  const where = common.STATUSES.includes(status) ? {status} : {};
  const grouped = await Order.findAll({attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']], group: ['status'], raw: true});
  const counts = Object.fromEntries(common.STATUSES.map(s => [s, Number(grouped.find(g => g.status === s)?.n || 0)]));
  const total = await Order.count({where});
  const pages = Math.max(1, Math.ceil(total / common.PAGE_SIZE));
  const current = Math.min(pages, Math.max(1, page));
  const rows = await Order.findAll({
    where, order: [['number', 'DESC']], limit: common.PAGE_SIZE, offset: (current - 1) * common.PAGE_SIZE,
    include: [{model: OrderItem, as: 'items', attributes: ['quantity', 'position', 'productName', 'image', 'size', 'unitPrice', 'productId']}]
  });
  return {orders: rows.map(toPlain), total, all: Object.values(counts).reduce((a, b) => a + b, 0), counts, page: current, pages};
}

async function find(number) {
  if (!Number.isSafeInteger(Number(number))) return null;
  const {Order, OrderItem} = db.models;
  return toPlain(await Order.findOne({where: {number: Number(number)}, include: [{model: OrderItem, as: 'items'}]}));
}

async function listByUser(userId) {
  const {Order, OrderItem} = db.models;
  const rows = await Order.findAll({where: {userId}, order: [['number', 'DESC']], include: [{model: OrderItem, as: 'items'}]});
  return rows.map(toPlain);
}

async function updateStatus(number, status, adminNote) {
  const row = await db.models.Order.findOne({where: {number: Number(number)}});
  if (!row) return null;
  await row.update({status, adminNote: String(adminNote || '').trim().slice(0, 500)});
  return find(number);
}

module.exports = {...common, create, list, find, listByUser, updateStatus};
