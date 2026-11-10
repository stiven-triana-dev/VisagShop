'use strict';
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: DataTypes.STRING(70), allowNull: false, unique: true, validate: {notEmpty: true}}
  }, {tableName: 'categories'});

  Category.associate = models => {
    Category.hasMany(models.Product, {as: 'products', foreignKey: 'categoryId'});
  };
  return Category;
};
