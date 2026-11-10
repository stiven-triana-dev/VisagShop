'use strict';
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    // Referencia pública (p001, p002...): aparece en URLs y en carritos guardados.
    id: {type: DataTypes.STRING(10), primaryKey: true, validate: {is: /^p\d{3,}$/}},
    name: {type: DataTypes.STRING(120), allowNull: false, validate: {len: [3, 120]}},
    description: {type: DataTypes.STRING(1000), allowNull: false, defaultValue: ''},
    price: {type: DataTypes.INTEGER, allowNull: true, validate: {min: 0}},
    image: {type: DataTypes.STRING(200), allowNull: false},
    categoryId: {type: DataTypes.INTEGER, allowNull: false},
    uploadId: {type: DataTypes.UUID, allowNull: true}
  }, {tableName: 'products', indexes: [{name: 'products_category_idx', fields: ['category_id']}]});

  Product.associate = models => {
    Product.belongsTo(models.Category, {as: 'category', foreignKey: 'categoryId', onDelete: 'RESTRICT', onUpdate: 'CASCADE'});
    Product.belongsTo(models.Upload, {as: 'upload', foreignKey: 'uploadId', onDelete: 'SET NULL', onUpdate: 'CASCADE'});
    Product.belongsToMany(models.Size, {as: 'sizes', through: models.ProductSize, foreignKey: 'productId', otherKey: 'sizeId'});
    Product.belongsToMany(models.Color, {as: 'colors', through: models.ProductColor, foreignKey: 'productId', otherKey: 'colorId'});
  };
  return Product;
};
