'use strict';
// Reglas compartidas por las validaciones (express-validator) y los modelos.
// public/js/validation.js aplica las mismas reglas en el navegador.
const NAME_MIN = 2;
const NAME_MAX = 75;
const EMAIL_MAX = 180;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PRODUCT_NAME_MIN = 5;
const PRODUCT_NAME_MAX = 120;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 1000;
const PHONE = /^[+0-9 ()-]{7,25}$/;

// Devuelve el primer problema de la contraseña o null si cumple todo.
function passwordProblem(password) {
  if (typeof password !== 'string' || password === '') return 'La contraseña es obligatoria.';
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `La contraseña puede tener máximo ${PASSWORD_MAX} caracteres.`;
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe incluir al menos un carácter especial (por ejemplo ! # $ % * -).';
  return null;
}

module.exports = {
  NAME_MIN, NAME_MAX, EMAIL_MAX, PASSWORD_MIN, PASSWORD_MAX,
  PRODUCT_NAME_MIN, PRODUCT_NAME_MAX, DESCRIPTION_MIN, DESCRIPTION_MAX, PHONE,
  passwordProblem
};
