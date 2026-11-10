'use strict';
// Genera datos académicos ficticios, NO cuentas reales. Las contraseñas se
// muestran una sola vez en consola y se almacenan solamente como hashes.
if(process.env.NODE_ENV==='production'){
 console.error('No está permitido crear usuarios de demostración en producción.');process.exit(1);
}
const crypto=require('node:crypto');
const users=require('../models/userModel');
for(const person of [
 {firstName:'Andrea',lastName:'Rojas',email:'andrea.visag@example.test'},
 {firstName:'Mateo',lastName:'López',email:'mateo.visag@example.test'}
]){
 if(users.all().some(u=>u.email===person.email)){
  console.log(`${person.email}: ya existe; se omite.`);continue;
 }
 const password=`Demo-${crypto.randomBytes(14).toString('base64url')}-7a`;
 users.register({...person,password});
 console.log(`Cuenta ficticia creada: ${person.email} · contraseña de prueba: ${password}`);
}
console.log('Los usuarios de ejemplo son ficticios; las contraseñas no se escriben en users.json.');
