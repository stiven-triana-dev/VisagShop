'use strict';
// Asistente con IA: VisagShop firma quién pregunta y reenvía la pregunta a VisagAssist.
// Se usa un VisagAssist falso (servidor local) que revisa el pase recibido.
const {test, before, after, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const SECRET = 'secreto-de-pruebas-con-al-menos-32-caracteres';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'visag-assistant-'));
delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.VISAG_DATA_DIR = tmp;
process.env.VISAGASSIST_SECRETO = SECRET;
process.env.ADMIN_USERNAME = 'admin-pruebas';
process.env.ADMIN_PASSWORD = 'clave-admin-de-pruebas';

// Decodifica y verifica un JWT HS256 como lo hace VisagAssist.
function verify(token) {
  const [header, payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
  assert.equal(signature, expected, 'firma válida');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {alg: 'HS256', typ: 'JWT'});
  return JSON.parse(Buffer.from(payload, 'base64url'));
}

let fake, shop, base, received, reply;
beforeEach(() => { received = []; reply = {status: 200, body: null}; });
before(async () => {
  fake = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      received.push({method: req.method, url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null});
      const body = reply.body ?? (req.url === '/api/v1/estado'
        ? {estado: 'OK'}
        : {conversacion_id: '0b6f3c1e-1111-4111-8111-111111111111', respuesta: 'Tenemos **2 gorras**', herramientas_usadas: ['buscar_productos'], uso: {costo_usd: 0.001}});
      const headers = {'Content-Type': 'application/json'};
      if (reply.status === 429) headers['Retry-After'] = '120';
      res.writeHead(reply.status, headers).end(JSON.stringify(body));
    });
  });
  await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
  process.env.VISAGASSIST_URL = `http://127.0.0.1:${fake.address().port}/`;
  const {app} = require('../app');
  await new Promise(resolve => { shop = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${shop.address().port}`;
});
after(async () => {
  await new Promise(resolve => shop.close(resolve));
  await new Promise(resolve => fake.close(resolve));
  fs.rmSync(tmp, {recursive: true, force: true});
});

const ask = (body, headers = {}, url = '/api/asistente/chat') => fetch(base + url, {
  method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body),
});
const adminAuth = {Authorization: 'Basic ' + Buffer.from('admin-pruebas:clave-admin-de-pruebas').toString('base64')};

test('un invitado pregunta: llega un pase firmado de invitado, sin IP y con vigencia corta', async () => {
  const response = await ask({mensaje: '  ¿Tienen gorras?  '});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  assert.deepEqual(data, {ok: true, conversacion_id: '0b6f3c1e-1111-4111-8111-111111111111', respuesta: 'Tenemos **2 gorras**'});
  assert.equal(data.uso, undefined, 'al navegador no le llegan tokens ni costos');

  const [call] = received;
  assert.equal(call.url, '/api/v1/chat');
  assert.deepEqual(call.body, {mensaje: '¿Tienen gorras?', conversacion_id: null});
  const pass = verify(call.auth.replace(/^Bearer /, ''));
  assert.equal(pass.rol, 'invitado');
  assert.equal(pass.iss, 'visagshop');
  assert.equal(pass.aud, 'visagassist');
  assert.equal(pass.sub, undefined);
  assert.ok(pass.exp - pass.iat <= 600, 'VisagAssist rechaza pases de más de 10 minutos');
  assert.match(pass.origen, /^[0-9a-f]{32}$/);
  assert.doesNotMatch(JSON.stringify(pass), /127\.0\.0\.1/, 'la IP no viaja, solo su huella');
});

test('en el panel responde como administrador, y sin la clave del panel no', async () => {
  assert.equal((await ask({mensaje: 'pendientes'}, {}, '/admin/api/asistente/chat')).status, 401);
  assert.equal(received.length, 0);
  const response = await ask({mensaje: '¿Qué pedidos están pendientes?'}, adminAuth, '/admin/api/asistente/chat');
  assert.equal(response.status, 200);
  assert.equal(verify(received[0].auth.slice(7)).rol, 'administrador');
});

test('el navegador no puede elegir su rol ni su usuario', async () => {
  await ask({mensaje: 'mis pedidos', rol: 'administrador', usuario_id: 'e8e092b5-ec08-40fc-a8e5-04a1ba0d5a65'});
  const pass = verify(received[0].auth.slice(7));
  assert.equal(pass.rol, 'invitado');
  assert.equal(pass.sub, undefined);
  assert.deepEqual(Object.keys(received[0].body).sort(), ['conversacion_id', 'mensaje']);
});

test('valida la pregunta antes de llamar al asistente', async () => {
  for (const body of [{}, {mensaje: '   '}, {mensaje: 'x'.repeat(501)}, {mensaje: 'hola', conversacion_id: 'no-es-un-id'}]) {
    const response = await ask(body);
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 40));
  }
  assert.equal(received.length, 0);
});

test('pasa el límite de VisagAssist con su Retry-After', async () => {
  reply = {status: 429, body: {detail: 'Llegaste al límite de preguntas por ahora.'}};
  const response = await ask({mensaje: 'hola'});
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '120');
  assert.equal((await response.json()).error, 'Llegaste al límite de preguntas por ahora.');
});

test('si VisagAssist falla, el cliente recibe un mensaje amable (sin detalles internos)', async () => {
  reply = {status: 500, body: {detail: 'Traceback: secreto interno'}};
  const response = await ask({mensaje: 'hola'});
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /Traceback|secreto/);
});

test('la ruta de estado despierta al asistente', async () => {
  const response = await fetch(base + '/api/asistente/estado');
  assert.equal(response.status, 200);
  assert.equal(received[0].url, '/api/v1/estado');
});

test('las páginas cargan la burbuja con la ruta correcta', async () => {
  const home = await (await fetch(base + '/')).text();
  assert.match(home, /<meta name="visag-assistant" content="\/api\/asistente">/);
  assert.match(home, /\/js\/assistant\.js\?v=/);
  const panel = await (await fetch(base + '/admin/orders', {headers: adminAuth})).text();
  assert.match(panel, /<meta name="visag-assistant" content="\/admin\/api\/asistente">/);
});

test('el pase de un cliente lleva su id; sin un id válido se atiende como invitado', () => {
  const assistant = require('../services/visagAssist');
  const id = 'e8e092b5-ec08-40fc-a8e5-04a1ba0d5a65';
  assert.deepEqual(assistant.identityFor({customer: {id, firstName: 'Sofía'}}), {rol: 'cliente', sub: id, nombre: 'Sofía'});
  assert.deepEqual(assistant.identityFor({customer: {id: '42'}}), {rol: 'invitado'});
  assert.deepEqual(assistant.identityFor({customer: null}), {rol: 'invitado'});
  const pass = verify(assistant.signPass({rol: 'cliente', sub: id}, SECRET, {ip: '200.1.1.1'}));
  assert.equal(pass.sub, id);
  assert.notEqual(assistant.fingerprint('200.1.1.1', SECRET), assistant.fingerprint('200.1.1.2', SECRET));
});
