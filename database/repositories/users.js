'use strict';
// Usuarios con Sequelize: crear (registro, con foto de perfil opcional),
// ver el detalle (perfil), editar el perfil y cambiar la contraseña.
const crypto = require('node:crypto');
const {UniqueConstraintError} = require('sequelize');
const db = require('../models');
const local = require('../../models/userModel');
const rules = require('../../validations/rules');
const {decodeImage} = require('../../validations/image');

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = email => String(email || '').trim().toLowerCase();
const credential = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};
const checkPassword = (row, password) => local.checkPassword(row && {password: row.passwordHash}, password);

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email,
    phone: row.phone || '', avatar: row.avatar || null, category: row.role,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null
  };
}

function checkProfile({firstName, lastName, email, phone}) {
  if (firstName.length < rules.NAME_MIN || firstName.length > rules.NAME_MAX || lastName.length < rules.NAME_MIN || lastName.length > rules.NAME_MAX) throw new Error('Ingresa nombre y apellidos válidos.');
  if (!validEmail.test(email) || email.length > rules.EMAIL_MAX) throw new Error('Correo electrónico no válido.');
  if (phone && !rules.PHONE.test(phone)) throw new Error('Teléfono no válido.');
}
function checkPasswordRules(password) {
  const problem = rules.passwordProblem(password);
  if (problem) throw new Error(problem);
}

async function emailExists(email, exceptId = null) {
  const row = await db.models.User.findOne({where: {email: normalizeEmail(email)}, attributes: ['id']});
  return Boolean(row && row.id !== exceptId);
}

async function register(fields) {
  const data = {
    firstName: String(fields?.firstName || '').trim().slice(0, rules.NAME_MAX),
    lastName: String(fields?.lastName || '').trim().slice(0, rules.NAME_MAX),
    email: normalizeEmail(fields?.email),
    phone: ''
  };
  checkProfile(data);
  checkPasswordRules(fields?.password);
  const image = fields?.imageData ? decodeImage(fields.imageData) : null;
  const {sequelize, User, Upload} = db.models;
  try {
    const row = await sequelize.transaction(async transaction => {
      let photo = {};
      if (image) {
        const upload = await Upload.create({id: crypto.randomUUID(), mime: image.mime, data: image.bytes}, {transaction});
        photo = {uploadId: upload.id, avatar: `/img/uploads/${upload.id}.${image.extension}`};
      }
      return User.create({id: crypto.randomUUID(), ...data, ...photo, passwordHash: credential(fields.password), role: 'customer'}, {transaction});
    });
    return publicUser(row);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new Error('Ya existe una cuenta con este correo.');
    throw error;
  }
}

async function authenticate(email, password) {
  const normalized = normalizeEmail(email);
  if (!validEmail.test(normalized) || typeof password !== 'string' || password.length > rules.PASSWORD_MAX) return null;
  const row = await db.models.User.findOne({where: {email: normalized}});
  return checkPassword(row, password) ? publicUser(row) : null;
}

async function find(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return publicUser(await db.models.User.findByPk(id));
}

async function updateProfile(id, changes) {
  const data = {
    firstName: String(changes?.firstName || '').trim(),
    lastName: String(changes?.lastName || '').trim(),
    email: normalizeEmail(changes?.email),
    phone: String(changes?.phone || '').trim()
  };
  checkProfile(data);
  const row = await db.models.User.findByPk(id);
  if (!row) throw new Error('No se encontró el usuario.');
  try {
    await row.update(data);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new Error('Ya existe una cuenta con este correo.');
    throw error;
  }
  return publicUser(row);
}

async function changePassword(id, currentPassword, newPassword, confirmPassword) {
  checkPasswordRules(newPassword);
  if (newPassword !== confirmPassword) throw new Error('Las contraseñas nuevas no coinciden.');
  if (newPassword === currentPassword) throw new Error('La contraseña nueva debe ser diferente.');
  const {sequelize, User, Session} = db.models;
  await sequelize.transaction(async transaction => {
    const row = await User.findByPk(id, {transaction, lock: transaction.LOCK.UPDATE});
    if (!row) throw new Error('No se encontró el usuario.');
    if (!checkPassword(row, currentPassword)) throw new Error('La contraseña actual no es correcta.');
    await row.update({passwordHash: credential(newPassword)}, {transaction});
    await Session.destroy({where: {userId: id}, transaction});
  });
  return true;
}

module.exports = {register, authenticate, find, updateProfile, changePassword, emailExists, publicUser, credential};
