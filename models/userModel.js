'use strict';
// Usuarios en archivos JSON (desarrollo local sin DATABASE_URL).
// Misma interfaz que database/repositories/users.js.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const rules=require('../validations/rules');
const dataDir=path.resolve(process.env.VISAG_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname,'..','data'));
const file=path.join(dataDir,'users.json');
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function all(){const result=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(result))throw new Error('JSON de usuarios inválido');return result;}
function write(items){const tmp=path.join(path.dirname(file),`.users-${process.pid}-${crypto.randomUUID()}.tmp`);try{fs.writeFileSync(tmp,JSON.stringify(items,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
function normalizeEmail(email){return String(email||'').trim().toLowerCase();}
function publicUser(user){return user&&{id:user.id,firstName:user.firstName,lastName:user.lastName,email:user.email,phone:user.phone||'',avatar:user.avatar||null,category:user.category,createdAt:user.createdAt||null};}
function credential(password){const salt=crypto.randomBytes(16).toString('hex');return `scrypt$${salt}$${crypto.scryptSync(password,salt,64).toString('hex')}`;}
function checkNames(firstName,lastName){
 if(firstName.length<rules.NAME_MIN||firstName.length>rules.NAME_MAX||lastName.length<rules.NAME_MIN||lastName.length>rules.NAME_MAX)throw new Error('Ingresa nombre y apellidos válidos.');
}
function checkPasswordRules(password){const problem=rules.passwordProblem(password);if(problem)throw new Error(problem);}
function emailExists(email,exceptId=null){const normalized=normalizeEmail(email);return all().some(u=>u.email===normalized&&u.id!==exceptId);}
function register(fields){
 if(!fields||typeof fields!=='object')throw new Error('Datos incorrectos.');
 const firstName=String(fields.firstName||'').trim().slice(0,rules.NAME_MAX),lastName=String(fields.lastName||'').trim().slice(0,rules.NAME_MAX);
 const email=normalizeEmail(fields.email),password=fields.password;
 checkNames(firstName,lastName);
 if(!validEmail.test(email)||email.length>rules.EMAIL_MAX)throw new Error('El correo electrónico no es válido.');
 checkPasswordRules(password);
 const items=all();
 if(items.some(x=>x.email===email))throw new Error('Ya existe una cuenta con este correo.');
 const avatar=fields.imageData?require('./productModel').uploadedPhoto(fields.imageData):null;
 const user={id:crypto.randomUUID(),firstName,lastName,email,password:credential(password),avatar,category:'customer',createdAt:new Date().toISOString()};
 items.push(user);write(items);return publicUser(user);
}
function checkPassword(user,password){
 if(!user||typeof password!=='string'||!password||password.length>rules.PASSWORD_MAX||typeof user.password!=='string')return false;
 const [algo,salt,stored]=user.password.split('$');
 if(algo!=='scrypt'||!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(stored))return false;
 return crypto.timingSafeEqual(crypto.scryptSync(password,salt,64),Buffer.from(stored,'hex'));
}
function authenticate(email,password){
 const normalized=normalizeEmail(email);
 if(!validEmail.test(normalized)||typeof password!=='string'||password.length>rules.PASSWORD_MAX)return null;
 const user=all().find(x=>x.email===normalized);
 if(!user||typeof user.password!=='string')return null;
 return checkPassword(user,password)?publicUser(user):null;
}
function find(id){return publicUser(all().find(u=>u.id===id)||null);}
function updateProfile(id,changes){
 if(!changes||typeof changes!=='object')throw new Error('Información inválida.');
 const items=all(),index=items.findIndex(u=>u.id===id);
 if(index===-1)throw new Error('No se encontró el usuario.');
 const firstName=String(changes.firstName||'').trim();
 const lastName=String(changes.lastName||'').trim();
 const email=normalizeEmail(changes.email);
 const phone=String(changes.phone||'').trim();
 checkNames(firstName,lastName);
 if(!validEmail.test(email)||email.length>rules.EMAIL_MAX)throw new Error('Correo electrónico no válido.');
 if(phone && !rules.PHONE.test(phone))throw new Error('Teléfono no válido.');
 if(items.some(u=>u.id!==id&&u.email===email))throw new Error('Ya existe una cuenta con este correo.');
 items[index]={...items[index],firstName,lastName,email,phone,updatedAt:new Date().toISOString()};
 write(items);return publicUser(items[index]);
}
function changePassword(id,currentPassword,newPassword,confirmPassword){
 const items=all(),index=items.findIndex(u=>u.id===id);
 if(index===-1)throw new Error('No se encontró el usuario.');
 if(!checkPassword(items[index],currentPassword))throw new Error('La contraseña actual no es correcta.');
 checkPasswordRules(newPassword);
 if(newPassword!==confirmPassword)throw new Error('Las contraseñas nuevas no coinciden.');
 if(currentPassword===newPassword)throw new Error('La contraseña nueva debe ser diferente.');
 items[index].password=credential(newPassword);
 items[index].updatedAt=new Date().toISOString();write(items);return true;
}
module.exports={all,register,authenticate,find,publicUser,updateProfile,changePassword,checkPassword,emailExists};
