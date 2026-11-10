'use strict';
// Fotografía subida desde el panel; se sirve en /img/uploads/<id>.<ext>.
module.exports = (sequelize, DataTypes) => {
  const Upload = sequelize.define('Upload', {
    id: {type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4},
    mime: {type: DataTypes.STRING(20), allowNull: false, validate: {isIn: [['image/jpeg', 'image/png', 'image/webp', 'image/gif']]}},
    data: {type: DataTypes.BLOB, allowNull: false}
  }, {tableName: 'uploads'});

  Upload.associate = models => {
    Upload.hasOne(models.Product, {as: 'product', foreignKey: 'uploadId'});
  };
  return Upload;
};
