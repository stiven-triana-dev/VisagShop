'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=name=>fs.readFileSync(path.join(root,name),'utf8');
test('Las rutas solicitadas por Sprint 4 usan sus métodos HTTP',()=>{
 const src=file('routes/products.js');
 for(const route of ["router.get('/'","router.get('/create'","router.post('/'","router.get('/:id/edit'","router.get('/:id'","router.put('/:id'","router.delete('/:id'"])
  assert.ok(src.includes(route),`Falta ${route}`);
});
test('Datos privados: products.json y users.json viven fuera de public',()=>{
 assert.equal(fs.existsSync(path.join(root,'public/data/products.json')),false);
 assert.equal(fs.existsSync(path.join(root,'public/data/users.json')),false);
 assert.equal(JSON.parse(file('data/products.json')).length,108);
 // users.json se crea en tiempo de ejecución local y está excluido por .gitignore.
 // El ZIP público no debe incluir cuentas reales ni datos de clientes.
 const usersFile=path.join(root,'data/users.json');
 if(fs.existsSync(usersFile)){
  const u=JSON.parse(fs.readFileSync(usersFile,'utf8'));
  assert.ok(Array.isArray(u));
  assert.equal(u.length,0);
 }else{
  assert.match(file('.gitignore'),/^data\/users\.json$/m);
 }
});
test('Conserva todas las fotografías originales del catálogo',()=>{
 for(const item of JSON.parse(file('data/products.json'))){
  assert.ok(fs.existsSync(path.join(root,'public',item.imagen.replace(/^\//,''))),`Falta ${item.imagen}`);
 }
});
test('La creación, edición y eliminación requieren autenticación de administrador',()=>{
 const src=file('routes/products.js');
 for(const name of ["router.post('/',mutationLimit,requireAdmin,sameOrigin","router.put('/:id',mutationLimit,requireAdmin,sameOrigin","router.delete('/:id',mutationLimit,requireAdmin,sameOrigin"])
  assert.ok(src.includes(name));
});
