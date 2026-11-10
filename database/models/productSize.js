'use strict';
// Tabla intermedia productos <-> tallas. "position" conserva el orden de las tallas.
module.exports = (sequelize, DataTypes) => sequelize.define('ProductSize', {
  productId: {type: DataTypes.STRING(10), primaryKey: true, references: {model: 'products', key: 'id'}, onDelete: 'CASCADE', onUpdate: 'CASCADE'},
  sizeId: {type: DataTypes.INTEGER, primaryKey: true, references: {model: 'sizes', key: 'id'}, onDelete: 'RESTRICT', onUpdate: 'CASCADE'},
  position: {type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0}
}, {tableName: 'product_sizes', timestamps: false});
