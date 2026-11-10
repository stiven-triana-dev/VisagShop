'use strict';
// Sprint 7 · Validaciones del back-end para crear y editar productos (express-validator).
const {body} = require('express-validator');
const products = require('../models/activeProducts');
const {decodeImage} = require('./image');
const R = require('./rules');

const text = v => (typeof v === 'string' ? v.trim() : '');
const list = v => (typeof v === 'string' ? v.split(/[;,\n]+/).map(s => s.trim()).filter(Boolean) : []);

const common = [
  body('nombre').customSanitizer(text)
    .notEmpty().withMessage('El nombre del producto es obligatorio.').bail()
    .isLength({min: R.PRODUCT_NAME_MIN}).withMessage(`El nombre debe tener al menos ${R.PRODUCT_NAME_MIN} caracteres.`).bail()
    .isLength({max: R.PRODUCT_NAME_MAX}).withMessage(`El nombre puede tener máximo ${R.PRODUCT_NAME_MAX} caracteres.`),
  body('descripcion').customSanitizer(text).optional({values: 'falsy'})
    .isLength({min: R.DESCRIPTION_MIN}).withMessage(`La descripción debe tener al menos ${R.DESCRIPTION_MIN} caracteres.`).bail()
    .isLength({max: R.DESCRIPTION_MAX}).withMessage(`La descripción puede tener máximo ${R.DESCRIPTION_MAX} caracteres.`),
  // Tabla secundaria: la categoría debe existir en la base de datos.
  body('categoria').customSanitizer(text)
    .notEmpty().withMessage('Selecciona una categoría.').bail()
    .custom(async value => {
      if (!(await products.listCategories()).includes(value)) throw new Error('La categoría seleccionada no existe.');
      return true;
    }),
  body('precio').customSanitizer(v => (v === null || v === undefined ? '' : String(v).trim())).optional({values: 'falsy'})
    .isInt({min: 0, max: 999999999}).withMessage('El precio debe ser un número entero en pesos, sin puntos ni decimales.'),
  body('tallas').custom(value => {
    if (list(value).some(t => t.length > 25)) throw new Error('Cada talla puede tener máximo 25 caracteres.');
    return true;
  }),
  body('colores').custom(value => {
    if (list(value).some(c => c.length > 25)) throw new Error('Cada color puede tener máximo 25 caracteres.');
    return true;
  })
];

const image = required => body('imageData').custom(value => {
  if (!value) {
    if (required) throw new Error('Selecciona una fotografía para el producto.');
    return true;
  }
  decodeImage(value);
  return true;
});

module.exports = {
  create: [...common, image(true)],
  update: [...common, image(false)]
};
