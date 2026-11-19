'use strict';
const crypto = require('node:crypto');

const ISSUER = 'visagshop';
const AUDIENCE = 'visagassist';
const PASS_SECONDS = 5 * 60;
const TIMEOUT_MS = 100 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function settings() {
  const url = String(process.env.VISAGASSIST_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const secret = String(process.env.VISAGASSIST_SECRETO || '');
  return { url, secret, enabled: /^https?:\/\//.test(url) && secret.length >= 32 };
}
const enabled = () => settings().enabled;
const base64url = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function fingerprint(ip, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`origen:${ip || 'desconocido'}`)
    .digest('hex')
    .slice(0, 32);
}

function identityFor(req, { admin = false } = {}) {
  if (admin) return { rol: 'administrador' };
  const customer = req.customer;
  if (customer && UUID.test(String(customer.id)))
    return {
      rol: 'cliente',
      sub: String(customer.id),
      nombre: String(customer.firstName || '').slice(0, 75) || undefined,
    };
  return { rol: 'invitado' };
}

function signPass(identity, secret, { ip, now = Date.now() } = {}) {
  const iat = Math.floor(now / 1000);
  const payload = {
    iss: ISSUER,
    aud: AUDIENCE,
    iat,
    exp: iat + PASS_SECONDS,
    ...identity,
    origen: fingerprint(ip, secret),
  };
  for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
  const unsigned = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

class AssistantError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function call(path, { method = 'GET', body, pass, fetchImpl = fetch } = {}) {
  const { url } = settings();
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (pass) headers.Authorization = `Bearer ${pass}`;
  let response;
  try {
    response = await fetchImpl(url + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('VisagAssist no respondió:', err.name === 'TimeoutError' ? 'tiempo agotado' : err.message);
    throw new AssistantError(
      504,
      'El asistente tardó demasiado en responder. Intenta de nuevo en un momento.',
    );
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (response.ok) return data;
  if (response.status === 429)
    throw new AssistantError(
      429,
      typeof data?.detail === 'string' ? data.detail : 'Hiciste muchas preguntas seguidas. Espera un rato.',
      response.headers.get('retry-after'),
    );
  if (response.status === 404)
    throw new AssistantError(404, 'La conversación ya no está disponible. Empieza una nueva.');
  if (response.status === 422)
    throw new AssistantError(400, 'Escribe una pregunta de máximo 500 caracteres.');
  console.error(`VisagAssist respondió ${response.status}`);
  throw new AssistantError(
    502,
    'El asistente no está disponible en este momento. Intenta más tarde o escríbenos por WhatsApp.',
  );
}

async function ask(req, { mensaje, conversacion_id }, { admin = false, fetchImpl } = {}) {
  const { secret } = settings();
  const pass = signPass(identityFor(req, { admin }), secret, { ip: req.ip });
  const data = await call('/api/v1/chat', {
    method: 'POST',
    body: { mensaje, conversacion_id: conversacion_id || null },
    pass,
    fetchImpl,
  });
  return { conversacion_id: data.conversacion_id, respuesta: data.respuesta };
}

async function wake({ fetchImpl } = {}) {
  await call('/api/v1/estado', { fetchImpl });
  return { ok: true };
}

module.exports = { enabled, ask, wake, signPass, identityFor, fingerprint, AssistantError };
