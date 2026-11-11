'use strict';
// Pedido solicitado desde el carrito. Guarda una copia de los datos de entrega
// y de las prendas, para que el pedido no cambie si luego se edita el catálogo.
const STATUSES = ['nuevo', 'confirmado', 'enviado', 'entregado', 'cancelado'];
const PAYMENTS = ['contraentrega', 'nequi', 'tarjeta'];

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4},
    // Número público del pedido (VS-1001, VS-1002...), sale de order_number_seq.
    number: {type: DataTypes.INTEGER, allowNull: false, unique: true},
    userId: {type: DataTypes.UUID, allowNull: true},
    status: {type: DataTypes.STRING(20), allowNull: false, defaultValue: 'nuevo', validate: {isIn: [STATUSES]}},
    firstName: {type: DataTypes.STRING(65), allowNull: false},
    lastName: {type: DataTypes.STRING(65), allowNull: false},
    phone: {type: DataTypes.STRING(22), allowNull: false},
    email: {type: DataTypes.STRING(120), allowNull: false, defaultValue: ''},
    document: {type: DataTypes.STRING(20), allowNull: false, defaultValue: ''},
    department: {type: DataTypes.STRING(70), allowNull: false},
    city: {type: DataTypes.STRING(70), allowNull: false},
    address: {type: DataTypes.STRING(140), allowNull: false},
    addressExtra: {type: DataTypes.STRING(140), allowNull: false, defaultValue: ''},
    postalCode: {type: DataTypes.STRING(12), allowNull: false, defaultValue: ''},
    billingAddress: {type: DataTypes.STRING(300), allowNull: false, defaultValue: ''},
    paymentMethod: {type: DataTypes.STRING(20), allowNull: false, validate: {isIn: [PAYMENTS]}},
    subtotal: {type: DataTypes.INTEGER, allowNull: false, defaultValue: 0},
    hasUnpriced: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false},
    adminNote: {type: DataTypes.STRING(500), allowNull: false, defaultValue: ''}
  }, {
    tableName: 'orders',
    indexes: [{name: 'orders_user_idx', fields: ['user_id']}, {name: 'orders_status_idx', fields: ['status']}]
  });

  Order.STATUSES = STATUSES;
  Order.PAYMENTS = PAYMENTS;
  Order.associate = models => {
    Order.belongsTo(models.User, {as: 'user', foreignKey: 'userId', onDelete: 'SET NULL', onUpdate: 'CASCADE'});
    Order.hasMany(models.OrderItem, {as: 'items', foreignKey: 'orderId'});
  };
  return Order;
};
