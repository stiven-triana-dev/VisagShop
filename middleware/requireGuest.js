'use strict';
module.exports = function requireGuest(req, res, next) {
  if (req.customer) {
    res.set('Cache-Control', 'no-store');
    return req.originalUrl.startsWith('/api/')
      ? res.status(409).json({ ok: false, error: 'Ya tienes una sesión iniciada.' })
      : res.redirect(303, '/profile');
  }
  next();
};
