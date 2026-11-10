'use strict';
// Usuarios con Sequelize: crear (registro), ver el detalle (perfil),
// editar el perfil y cambiar la contraseña.
const crypto = require('node:crypto');
const {UniqueConstraintError} = require('sequelize');
const db = require('../models');
const local = require('../../models/userModel');

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
    phone: row.phone || '', category: row.role,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null
  };
}

function checkProfile({firstName, lastName, email, phone}) {
  if (firstName.length < 2 || firstName.length > 75 || lastName.length < 2 || lastName.length > 75) throw new Error('Ingresa nombre y apellidos válidos.');
  if (!validEmail.test(email) || email.length > 180) throw new Error('Correo electrónico no válido.');
  if (phone && !/^[+0-9 ()-]{7,25}$/.test(phone)) throw new Error('Teléfono no válido.');
}

async function register(fields) {
  const data = {
    firstName: String(fields?.firstName || '').trim().slice(0, 75),
    lastName: String(fields?.lastName || '').trim().slice(0, 75),
    email: normalizeEmail(fields?.email),
    phone: ''
  };
  checkProfile(data);
  const password = fields?.password;
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new Error('La contraseña debe tener entre 10 y 128 caracteres.');
  try {
    const row = await db.models.User.create({id: crypto.randomUUID(), ...data, passwordHash: credential(password), role: 'customer'});
    return publicUser(row);
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new Error('Ya existe una cuenta con este correo.');
    throw error;
  }
}

async function authenticate(email, password) {
  const normalized = normalizeEmail(email);
  if (!validEmail.test(normalized) || typeof password !== 'string' || password.length > 128) return null;
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
  if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128) throw new Error('La contraseña nueva debe tener entre 10 y 128 caracteres.');
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

module.exports = {register, authenticate, find, updateProfile, changePassword, publicUser, credential};
