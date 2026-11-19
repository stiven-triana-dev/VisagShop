'use strict';
const crypto = require('crypto');
function matches(actual, expected) {
  const a = crypto.createHash('sha256').update(actual).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
module.exports = function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 10) {
    return res
      .status(503)
      .type('text/plain')
      .send(
        'Panel deshabilitado: configura ADMIN_USERNAME y ADMIN_PASSWORD (mínimo 10 caracteres). Revisa README.md.',
      );
  }
  const auth = req.headers.authorization || '';
  const encoded = /^Basic (.+)$/i.exec(auth)?.[1];
  if (!encoded || encoded.length > 1024) {
    res.set('WWW-Authenticate', 'Basic realm="VisagShop Admin", charset="UTF-8"');
    return res.status(401).send('Se requiere autenticación de administrador.');
  }
  let credentials;
  try {
    credentials = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    credentials = '';
  }
  const index = credentials.indexOf(':');
  const user = index === -1 ? '' : credentials.slice(0, index);
  const pass = index === -1 ? '' : credentials.slice(index + 1);
  if (!matches(user, username) || !matches(pass, password)) {
    res.set('WWW-Authenticate', 'Basic realm="VisagShop Admin", charset="UTF-8"');
    return res.status(401).send('Credenciales incorrectas.');
  }
  next();
};
