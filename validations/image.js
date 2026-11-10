'use strict';
// Validación de imágenes enviadas como data URL (base64) desde los formularios.
// Se comprueba el tipo declarado, el tamaño y la firma real del archivo, para que
// un archivo renombrado (por ejemplo, un .exe con extensión .jpg) no pase.
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = {
  jpeg: {mime: 'image/jpeg', ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff},
  png: {mime: 'image/png', ext: 'png', test: b => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))},
  gif: {mime: 'image/gif', ext: 'gif', test: b => ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))},
  webp: {mime: 'image/webp', ext: 'webp', test: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'}
};
const ALLOWED_TEXT = 'JPG, JPEG, PNG, GIF o WebP';

function decodeImage(data) {
  if (typeof data !== 'string' || data.length > Math.ceil(MAX_BYTES * 4 / 3) + 100) throw new Error('La imagen debe pesar 3 MB o menos.');
  const match = /^data:image\/(jpeg|jpg|png|gif|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if (!match) throw new Error(`La imagen debe ser un archivo ${ALLOWED_TEXT}.`);
  const type = TYPES[match[1] === 'jpg' ? 'jpeg' : match[1]];
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 12 || bytes.length > MAX_BYTES) throw new Error('La imagen está vacía o pesa más de 3 MB.');
  if (!type.test(bytes)) throw new Error('El archivo no es una imagen válida o no coincide con su formato.');
  return {bytes, mime: type.mime, extension: type.ext};
}

module.exports = {decodeImage, MAX_BYTES, ALLOWED_TEXT};
