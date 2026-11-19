'use strict';
module.exports = function requireCustomer(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (req.customer) return next();
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'Debes iniciar sesión para continuar.' });
  }
  const target =
    req.originalUrl.startsWith('/') && !req.originalUrl.startsWith('//') ? req.originalUrl : '/profile';
  return res.redirect(303, `/login?next=${encodeURIComponent(target)}`);
};
