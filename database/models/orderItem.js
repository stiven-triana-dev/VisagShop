'use strict';
// Prenda dentro de un pedido. Conserva nombre, foto y precio del momento de la compra;
// product_id queda en NULL si el producto se elimina del catálogo después.
module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    orderId: {type: DataTypes.UUID, allowNull: false},
    productId: {type: DataTypes.STRING(10), allowNull: true},
    productName: {type: DataTypes.STRING(120), allowNull: false},
    image: {type: DataTypes.STRING(200), allowNull: false, defaultValue: ''},
    size: {type: DataTypes.STRING(50), allowNull: false, defaultValue: ''},
    quantity: {type: DataTypes.SMALLINT, allowNull: false, validate: {min: 1, max: 99}},
    unitPrice: {type: DataTypes.INTEGER, allowNull: true},
    position: {type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0}
  }, {tableName: 'order_items', timestamps: false, indexes: [{name: 'order_items_order_idx', fields: ['order_id']}]});

  OrderItem.associate = models => {
    OrderItem.belongsTo(models.Order, {as: 'order', foreignKey: 'orderId', onDelete: 'CASCADE', onUpdate: 'CASCADE'});
    OrderItem.belongsTo(models.Product, {as: 'product', foreignKey: 'productId', onDelete: 'SET NULL', onUpdate: 'CASCADE'});
  };
  return OrderItem;
};
