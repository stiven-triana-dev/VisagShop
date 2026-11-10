'use strict';
module.exports = (sequelize, DataTypes) => {
  const Size = sequelize.define('Size', {
    id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: DataTypes.STRING(25), allowNull: false, unique: true, validate: {notEmpty: true}}
  }, {tableName: 'sizes'});

  Size.associate = models => {
    Size.belongsToMany(models.Product, {as: 'products', through: models.ProductSize, foreignKey: 'sizeId', otherKey: 'productId'});
  };
  return Size;
};
