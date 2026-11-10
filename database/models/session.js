'use strict';
module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    tokenHash: {type: DataTypes.CHAR(64), primaryKey: true},
    userId: {type: DataTypes.UUID, allowNull: false},
    remember: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false},
    expiresAt: {type: DataTypes.DATE, allowNull: false}
  }, {
    tableName: 'sessions',
    updatedAt: false,
    indexes: [{name: 'sessions_user_idx', fields: ['user_id']}, {name: 'sessions_expires_idx', fields: ['expires_at']}]
  });

  Session.associate = models => {
    Session.belongsTo(models.User, {as: 'user', foreignKey: 'userId', onDelete: 'CASCADE', onUpdate: 'CASCADE'});
  };
  return Session;
};
