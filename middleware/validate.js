'use strict';
const { validationResult } = require('express-validator');

module.exports = function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();
      const errors = {};
      for (const item of result.array({ onlyFirstError: true })) {
        if (item.type === 'field' && !errors[item.path]) errors[item.path] = item.msg;
      }
      const first = Object.values(errors)[0] || 'Revisa los datos del formulario.';
      return res.status(400).json({ ok: false, error: first, errors });
    },
  ];
};
