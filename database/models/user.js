'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4},
    firstName: {type: DataTypes.STRING(75), allowNull: false, validate: {len: [2, 75]}},
    lastName: {type: DataTypes.STRING(75), allowNull: false, validate: {len: [2, 75]}},
    email: {type: DataTypes.STRING(180), allowNull: false, unique: true, validate: {isEmail: true}},
    phone: {type: DataTypes.STRING(25), allowNull: false, defaultValue: ''},
    // Formato "scrypt$<sal>$<hash>": la contraseña nunca se guarda en texto plano.
    passwordHash: {type: DataTypes.STRING(200), allowNull: false},
    role: {type: DataTypes.STRING(20), allowNull: false, defaultValue: 'customer', validate: {isIn: [['customer']]}},
    // Foto de perfil opcional (Sprint 7): ruta pública y fila de uploads que la guarda.
    avatar: {type: DataTypes.STRING(200), allowNull: true},
    uploadId: {type: DataTypes.UUID, allowNull: true}
  }, {tableName: 'users'});

  User.associate = models => {
    User.hasMany(models.Session, {as: 'sessions', foreignKey: 'userId'});
    User.belongsTo(models.Upload, {as: 'photo', foreignKey: 'uploadId', onDelete: 'SET NULL', onUpdate: 'CASCADE'});
    User.hasMany(models.Order, {as: 'orders', foreignKey: 'userId'});
  };
  return User;
};
