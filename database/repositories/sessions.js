'use strict';
// Sesiones de clientes con Sequelize. El navegador recibe un token aleatorio
// opaco en una cookie httpOnly; en la tabla sessions solo se guarda su SHA-256.
const crypto = require('node:crypto');
const {Op} = require('sequelize');
const db = require('../models');
const users = require('./users');

const cookieName = 'visag_session';
const sessionSeconds = 12 * 60 * 60;
const rememberedSeconds = 30 * 24 * 60 * 60;
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const parseCookies = raw => Object.fromEntries(String(raw || '').split(';').map(pair => {
  const at = pair.indexOf('=');
  return at < 0 ? [] : [pair.slice(0, at).trim(), pair.slice(at + 1).trim()];
}).filter(pair => pair.length === 2));

function cookieSettings(req, remember) {
  const options = {httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.NODE_ENV === 'production', path: '/'};
  if (remember) options.maxAge = rememberedSeconds * 1000;
  return options;
}

async function attach(req, res, next) {
  try {
    req.customer = null; req.sessionTokenHash = null; res.locals.customer = null;
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      const digest = hash(token);
      const session = await db.models.Session.findOne({where: {tokenHash: digest, expiresAt: {[Op.gt]: new Date()}}});
      if (session) {
        const user = await users.find(session.userId);
        if (user) { req.customer = user; req.sessionTokenHash = digest; res.locals.customer = user; }
      }
    }
    next();
  } catch (error) { next(error); }
}

async function login(req, res, user, remember = false) {
  if (!user?.id) throw new Error('Cuenta inválida.');
  const token = crypto.randomBytes(32).toString('hex');
  const {sequelize, Session} = db.models;
  await sequelize.transaction(async transaction => {
    if (req.sessionTokenHash) await Session.destroy({where: {tokenHash: req.sessionTokenHash}, transaction});
    // Limpieza de sesiones vencidas para que la tabla no crezca sin límite.
    await Session.destroy({where: {expiresAt: {[Op.lte]: new Date()}}, transaction});
    await Session.create({
      tokenHash: hash(token), userId: user.id, remember: Boolean(remember),
      expiresAt: new Date(Date.now() + (remember ? rememberedSeconds : sessionSeconds) * 1000)
    }, {transaction});
  });
  res.cookie(cookieName, token, cookieSettings(req, remember));
}

async function logout(req, res) {
  if (req.sessionTokenHash) await db.models.Session.destroy({where: {tokenHash: req.sessionTokenHash}});
  res.clearCookie(cookieName, {httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.NODE_ENV === 'production', path: '/'});
}

async function revokeAll(userId) { await db.models.Session.destroy({where: {userId}}); }

module.exports = {attach, login, logout, revokeAll, sessionSeconds, rememberedSeconds};
