'use strict';
// Ejecuta una lista de validaciones de express-validator y, si hay errores,
// responde 400 con el primer mensaje (error) y uno por campo (errors), que el
// navegador muestra debajo de cada campo del formulario.
const {validationResult} = require('express-validator');

module.exports = function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();
      const errors = {};
      for (const item of result.array({onlyFirstError: true})) {
        if (item.type === 'field' && !errors[item.path]) errors[item.path] = item.msg;
      }
      const first = Object.values(errors)[0] || 'Revisa los datos del formulario.';
      return res.status(400).json({ok: false, error: first, errors});
    }
  ];
};
