'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const users = require('../models/userModel');
const file = path.join(
  path.resolve(
    process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data'),
  ),
  'sessions.json',
);
const cookieName = 'visag_session';
const sessionSeconds = 12 * 60 * 60;
const rememberedSeconds = 30 * 24 * 60 * 60;
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const parseCookies = (raw) =>
  Object.fromEntries(
    String(raw || '')
      .split(';')
      .map((pair) => {
        const split = pair.indexOf('=');
        return split === -1 ? [] : [pair.slice(0, split).trim(), pair.slice(split + 1).trim()];
      })
      .filter((item) => item.length === 2),
  );
function read() {
  try {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
function write(rows) {
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(rows, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function cookieSettings(req, remember) {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || process.env.NODE_ENV === 'production',
    path: '/',
  };
  if (remember) options.maxAge = rememberedSeconds * 1000;
  return options;
}
function load(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const digest = hash(token);
  const active = read().find((row) => row.tokenHash === digest && row.expiresAt > Date.now());
  if (!active) return null;
  const user = users.find(active.userId);
  return user ? { user, tokenHash: digest, remember: Boolean(active.remember) } : null;
}
function attach(req, res, next) {
  try {
    const current = load(req);
    req.customer = current?.user || null;
    req.sessionTokenHash = current?.tokenHash || null;
    res.locals.customer = req.customer;
    next();
  } catch (err) {
    next(err);
  }
}
function login(req, res, user, remember = false) {
  if (!user || !user.id) throw new Error('Cuenta inválida.');
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = remember ? rememberedSeconds : sessionSeconds;
  const rows = read().filter((s) => s.expiresAt > Date.now());
  if (req.sessionTokenHash) {
    const index = rows.findIndex((s) => s.tokenHash === req.sessionTokenHash);
    if (index !== -1) rows.splice(index, 1);
  }
  rows.push({
    tokenHash: hash(token),
    userId: user.id,
    remember: Boolean(remember),
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  });
  write(rows);
  res.cookie(cookieName, token, cookieSettings(req, Boolean(remember)));
}
function logout(req, res) {
  if (req.sessionTokenHash)
    write(read().filter((s) => s.tokenHash !== req.sessionTokenHash && s.expiresAt > Date.now()));
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || process.env.NODE_ENV === 'production',
    path: '/',
  });
}
function revokeAll(userId) {
  write(read().filter((s) => s.userId !== userId && s.expiresAt > Date.now()));
}
module.exports = { attach, login, logout, revokeAll, read, sessionSeconds, rememberedSeconds };
