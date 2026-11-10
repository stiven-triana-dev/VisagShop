'use strict';
// Sprint 7 · Validaciones del back-end para registro, login y perfil (express-validator).
const {body} = require('express-validator');
const users = require('../models/activeUsers');
const {decodeImage} = require('./image');
const R = require('./rules');

const personName = (field, label) => body(field)
  .customSanitizer(v => (typeof v === 'string' ? v.trim() : ''))
  .notEmpty().withMessage(`El ${label} es obligatorio.`).bail()
  .isLength({min: R.NAME_MIN}).withMessage(`El ${label} debe tener al menos ${R.NAME_MIN} caracteres.`).bail()
  .isLength({max: R.NAME_MAX}).withMessage(`El ${label} puede tener máximo ${R.NAME_MAX} caracteres.`);

const email = () => body('email')
  .customSanitizer(v => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
  .notEmpty().withMessage('El correo electrónico es obligatorio.').bail()
  .isEmail().withMessage('Ingresa un correo electrónico válido (ejemplo@correo.com).').bail()
  .isLength({max: R.EMAIL_MAX}).withMessage('El correo electrónico es demasiado largo.');

const strongPassword = field => body(field).custom(value => {
  const problem = R.passwordProblem(value);
  if (problem) throw new Error(problem);
  return true;
});

const sameAs = (field, other, message) => body(field)
  .notEmpty().withMessage('Confirma la contraseña.').bail()
  .custom((value, {req}) => {
    if (value !== req.body[other]) throw new Error(message);
    return true;
  });

const optionalImage = field => body(field).optional({values: 'falsy'}).custom(value => {
  decodeImage(value); // lanza un error con el mensaje adecuado si no es válida
  return true;
});

const register = [
  personName('firstName', 'nombre'),
  personName('lastName', 'apellido'),
  email().bail().custom(async value => {
    if (await users.emailExists(value)) throw new Error('Ya existe una cuenta con este correo.');
    return true;
  }),
  strongPassword('password'),
  sameAs('confirm', 'password', 'Las contraseñas no coinciden.'),
  optionalImage('imageData')
];

const login = [
  email().bail().custom(async value => {
    if (!await users.emailExists(value)) throw new Error('No hay una cuenta registrada con este correo.');
    return true;
  }),
  body('password').notEmpty().withMessage('La contraseña es obligatoria.')
];

const profile = [
  personName('firstName', 'nombre'),
  personName('lastName', 'apellido'),
  email().bail().custom(async (value, {req}) => {
    if (await users.emailExists(value, req.customer?.id)) throw new Error('Ya existe una cuenta con este correo.');
    return true;
  }),
  body('phone')
    .customSanitizer(v => (typeof v === 'string' ? v.trim() : ''))
    .optional({values: 'falsy'})
    .matches(R.PHONE).withMessage('Ingresa un teléfono válido (solo números, espacios, +, - o paréntesis).')
];

const password = [
  body('currentPassword').notEmpty().withMessage('Escribe tu contraseña actual.'),
  strongPassword('newPassword').bail().custom((value, {req}) => {
    if (value === req.body.currentPassword) throw new Error('La contraseña nueva debe ser diferente a la actual.');
    return true;
  }),
  sameAs('confirmPassword', 'newPassword', 'Las contraseñas nuevas no coinciden.')
];

module.exports = {register, login, profile, password};
