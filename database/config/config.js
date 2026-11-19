'use strict';
const common = {
  use_env_variable: 'DATABASE_URL',
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
  pool: { max: 3, min: 0, acquire: 15000, idle: 30000 },
};

module.exports = {
  development: { ...common },
  test: { ...common },
  production: { ...common },
};
