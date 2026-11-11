'use strict';
// Punto de entrada de Sequelize: crea la conexión, carga los modelos y
// declara sus relaciones (associate). Equivale al models/index.js que genera
// sequelize-cli, pero con la lista de modelos explícita y conexión perezosa:
// solo se conecta cuando existe DATABASE_URL y algún módulo usa un modelo.
const {Sequelize} = require('sequelize');

const envName = ['production', 'test'].includes(process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';
const config = require('../config/config.js')[envName];

const definitions = [
  require('./category'),
  require('./size'),
  require('./color'),
  require('./upload'),
  require('./product'),
  require('./productSize'),
  require('./productColor'),
  require('./user'),
  require('./session'),
  require('./order'),
  require('./orderItem')
];

const db = {};

function connect() {
  if (db.sequelize) return db;
  const url = process.env[config.use_env_variable];
  if (!url) throw new Error('DATABASE_URL no configurada.');
  const {use_env_variable: _unused, ...options} = config;
  const sequelize = new Sequelize(url, options);
  for (const define of definitions) {
    const model = define(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  }
  for (const model of Object.values(db)) {
    if (typeof model.associate === 'function') model.associate(db);
  }
  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
}

// Cierra la conexión (scripts y pruebas). La siguiente consulta vuelve a conectar.
async function close() {
  if (!db.sequelize) return;
  const sequelize = db.sequelize;
  for (const key of Object.keys(db)) delete db[key];
  await sequelize.close();
}

module.exports = {
  connect,
  close,
  get models() { return connect(); }
};
