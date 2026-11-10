'use strict';
// Configuración de Sequelize (también la usa sequelize-cli a través de .sequelizerc).
// La conexión se toma siempre de DATABASE_URL para no escribir credenciales en Git.
//   Local: postgresql://usuario:clave@localhost:5432/visagshop
//   Neon:  postgresql://usuario:clave@servidor.neon.tech/neondb?sslmode=require
const common = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: false,
  define: {underscored: true},
  pool: {max: 3, min: 0, acquire: 15000, idle: 30000}
};

module.exports = {
  development: {...common},
  test: {...common},
  production: {...common}
};
