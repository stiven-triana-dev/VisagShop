'use strict';
// Tabla intermedia productos <-> colores.
module.exports = (sequelize, DataTypes) => sequelize.define('ProductColor', {
  productId: {type: DataTypes.STRING(10), primaryKey: true, references: {model: 'products', key: 'id'}, onDelete: 'CASCADE', onUpdate: 'CASCADE'},
  colorId: {type: DataTypes.INTEGER, primaryKey: true, references: {model: 'colors', key: 'id'}, onDelete: 'RESTRICT', onUpdate: 'CASCADE'},
  position: {type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0}
}, {tableName: 'product_colors', timestamps: false});
