'use strict';
// Validación del pedido que llega desde el carrito (express-validator).
// Los nombres de campo son los del formulario de views/products/cart.ejs.
const {body} = require('express-validator');
const products = require('../models/activeProducts');
const orders = require('../models/orderModel');

const text = v => (typeof v === 'string' ? v.trim() : '');
const required = (field, label, min, max) => body(field).customSanitizer(text)
  .notEmpty().withMessage(`${label} es obligatorio.`).bail()
  .isLength({min}).withMessage(`${label} debe tener al menos ${min} caracteres.`).bail()
  .isLength({max}).withMessage(`${label} puede tener máximo ${max} caracteres.`);
const optional = (field, max) => body(field).customSanitizer(text).isLength({max}).withMessage(`Máximo ${max} caracteres.`);
const billing = (field, label) => body(field).customSanitizer(text).custom((value, {req}) => {
  if (req.body.facturacion === 'diferente' && value.length < 2) throw new Error(`${label} de facturación es obligatorio.`);
  if (value.length > 140) throw new Error('Máximo 140 caracteres.');
  return true;
});

const create = [
  body('items').isArray({min: 1, max: 30}).withMessage('Tu carrito está vacío o tiene demasiadas prendas.').bail()
    .custom(async items => {
      for (const line of items) {
        if (!line || typeof line.id !== 'string' || !/^p\d{3,}$/.test(line.id)) throw new Error('Hay una prenda inválida en tu carrito.');
        if (!Number.isInteger(line.cant) || line.cant < 1 || line.cant > 99) throw new Error('La cantidad de cada prenda debe estar entre 1 y 99.');
        if (line.talla !== undefined && (typeof line.talla !== 'string' || line.talla.length > 50)) throw new Error('Hay una talla inválida en tu carrito.');
        const product = await products.find(line.id);
        if (!product) throw new Error('Una de las prendas ya no está disponible. Actualiza tu carrito.');
        // Si la prenda tiene tallas publicadas, la elegida debe ser una de ellas.
        if (line.talla && product.tallas?.length && !product.tallas.includes(line.talla)) throw new Error(`La talla ${line.talla} no está disponible para ${product.nombre}.`);
      }
      return true;
    }),
  required('nombre', 'El nombre', 2, 65),
  required('apellidos', 'El apellido', 2, 65),
  body('celular').customSanitizer(text)
    .notEmpty().withMessage('El celular es obligatorio.').bail()
    .matches(/^[+0-9 ()-]{7,22}$/).withMessage('Ingresa un celular válido (solo números, espacios, +, - o paréntesis).'),
  body('email').customSanitizer(text).optional({values: 'falsy'})
    .isEmail().withMessage('Ingresa un correo válido (ejemplo@correo.com).').bail()
    .isLength({max: 120}).withMessage('El correo es demasiado largo.'),
  body('documento').customSanitizer(text).optional({values: 'falsy'})
    .matches(/^[0-9A-Za-z.-]{4,20}$/).withMessage('Ingresa un documento válido (solo números y letras).'),
  required('departamento', 'El departamento', 2, 70),
  required('ciudad', 'La ciudad', 2, 70),
  required('direccion', 'La dirección', 5, 140),
  optional('complemento', 140),
  body('postal').customSanitizer(text).optional({values: 'falsy'}).matches(/^[0-9]{4,12}$/).withMessage('El código postal solo lleva números.'),
  body('medio-pago').isIn(orders.PAYMENTS).withMessage('Elige un método de pago.'),
  body('facturacion').optional().isIn(['misma', 'diferente']).withMessage('Elige la dirección de facturación.'),
  billing('fact_direccion', 'La dirección'),
  billing('fact_ciudad', 'La ciudad'),
  billing('fact_departamento', 'El departamento')
];

const status = [
  body('status').isIn(orders.STATUSES).withMessage('Elige un estado válido.'),
  body('adminNote').customSanitizer(text).isLength({max: 500}).withMessage('La nota puede tener máximo 500 caracteres.')
];

module.exports = {create, status};
