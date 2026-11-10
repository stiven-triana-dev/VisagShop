'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.resolve(process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data'));
const file = path.join(dataDir, 'products.json');
const uploadDirectory = (process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH) ? path.join(dataDir, 'uploads') : path.join(__dirname, '..', 'public', 'img', 'uploads');
const sequenceFile=path.join(dataDir,'product-sequence.json');
const categories = Object.freeze(['Pantalones','Pantalonetas','Bermudas','Sudaderas','Gorras','Zapatos']);
const MAX_FILE = 3 * 1024 * 1024;

function all() {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('Catálogo inválido');
  return rows;
}
function find(id) {return all().find(p => p.id === id) || null;}
// Misma búsqueda que la versión con base de datos: texto en nombre, descripción o categoría.
function search({q='', categoria=''}={}) {
  const text = String(q).trim().slice(0,80).toLowerCase();
  return all().filter(p => (!categories.includes(categoria) || p.categoria === categoria) &&
    (!text || [p.nombre, p.descripcion, p.categoria].some(v => String(v||'').toLowerCase().includes(text))));
}
function atomicWrite(items) {
  const tmp = path.join(path.dirname(file), `.products-${process.pid}-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2) + '\n', {encoding:'utf8',mode:0o600});
    fs.renameSync(tmp, file);
  } finally {if (fs.existsSync(tmp)) fs.unlinkSync(tmp);}
}
function stringField(value, max=150) {return typeof value === 'string' ? value.trim().slice(0,max) : '';}
function splitList(value) {
  const list = typeof value==='string' ? value.split(/[;,\n]+/) : Array.isArray(value) ? value : [];
  return [...new Set(list.map(s=>stringField(s,25)).filter(Boolean))].slice(0,30);
}
function validate(input, previous) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Datos de producto inválidos.');
  const nombre=stringField(input.nombre,120), descripcion=stringField(input.descripcion,1000);
  const categoria=stringField(input.categoria,70);
  if (nombre.length<3) throw new Error('El nombre debe tener al menos 3 caracteres.');
  if (!categories.includes(categoria)) throw new Error('Categoría no válida.');
  const rawPrice = String(input.precio??'').trim();
  const precio = rawPrice === '' ? null : Number(rawPrice);
  if (precio !== null && (!Number.isSafeInteger(precio) || precio < 0 || precio > 999999999)) {
    throw new Error('El precio debe ser un entero en pesos colombianos o dejarse vacío.');
  }
  return {
    ...(previous? {id:previous.id} : {}),
    nombre, descripcion, categoria, precio,
    tallas:splitList(input.tallas),
    colores:splitList(input.colores),
    imagen:previous ? previous.imagen : '/img/p001.jpg'
  };
}
function uploadedPhoto(data) {
  if (!data) return null;
  if (typeof data !== 'string' || data.length > Math.ceil(MAX_FILE*4/3)+100) throw new Error('Foto demasiado grande. Máximo 3 MB.');
  const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if (!match) throw new Error('Formato de imagen inválido: usa JPG, PNG o WebP.');
  const buf=Buffer.from(match[2],'base64');
  if (!buf.length || buf.length>MAX_FILE) throw new Error('La imagen debe pesar 3 MB o menos.');
  const jpeg=buf.length>3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff;
  const png=buf.length>8&&buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const webp=buf.length>12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP';
  const type=match[1];
  if (!((type==='jpeg'&&jpeg)||(type==='png'&&png)||(type==='webp'&&webp))) throw new Error('La imagen no corresponde al formato declarado.');
  const ext=type==='jpeg'?'jpg':type;
  fs.mkdirSync(uploadDirectory,{recursive:true});
  const name=crypto.randomUUID()+'.'+ext;
  fs.writeFileSync(path.join(uploadDirectory,name),buf,{flag:'wx'});
  return '/img/uploads/'+name;
}
function create(input) {
  const product=validate(input,null);
  if (!input.imageData) throw new Error('Selecciona una fotografía para el producto nuevo.');
  const rows=all();
  const maximum=rows.reduce((v,p)=>Math.max(v,Number(/^p(\d+)$/.exec(p.id)?.[1]||0)),0);
  let previousMaximum=0;
  try {previousMaximum=Number(JSON.parse(fs.readFileSync(sequenceFile,'utf8')).lastNumber)||0;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const nextNumber=Math.max(maximum,previousMaximum)+1;
  product.id=`p${String(nextNumber).padStart(3,'0')}`;
  product.imagen=uploadedPhoto(input.imageData);
  rows.unshift(product);atomicWrite(rows);
  // Mantener el contador separado permite evitar reutilizar el ID de una prenda eliminada.
  fs.writeFileSync(sequenceFile,JSON.stringify({lastNumber:nextNumber})+'\n',{encoding:'utf8',mode:0o600});
  return product;
}
function update(id,input) {
  const rows=all();const index=rows.findIndex(p=>p.id===id);
  if (index<0) return null;
  const product=validate(input,rows[index]);
  if (input.imageData) product.imagen=uploadedPhoto(input.imageData);
  rows[index]={...rows[index], ...product};
  atomicWrite(rows);
  return rows[index];
}
function remove(id) {
  const rows=all();
  const index=rows.findIndex(p=>p.id===id);
  if (index===-1) return null;
  const [removed]=rows.splice(index,1);
  atomicWrite(rows);
  // Eliminar solamente imágenes que fueron subidas por el administrador.
  // Jamás se eliminan las fotos originales del catálogo.
  if (/^\/img\/uploads\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(removed.imagen||'')) {
    const target=path.join(uploadDirectory,path.basename(removed.imagen));
    try {fs.unlinkSync(target);}catch(err){if(err.code!=='ENOENT')console.warn('No se pudo limpiar la imagen:',err.message);}
  }
  return removed;
}
module.exports={all,find,search,create,update,remove,categories,validate};
