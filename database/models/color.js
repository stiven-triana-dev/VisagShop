'use strict';
module.exports = (sequelize, DataTypes) => {
  const Color = sequelize.define('Color', {
    id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: DataTypes.STRING(25), allowNull: false, unique: true, validate: {notEmpty: true}}
  }, {tableName: 'colors'});

  Color.associate = models => {
    Color.belongsToMany(models.Product, {as: 'products', through: models.ProductColor, foreignKey: 'colorId', otherKey: 'productId'});
  };
  return Color;
};
