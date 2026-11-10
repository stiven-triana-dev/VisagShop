'use strict';
const model=require('../models/activeUsers');
const session=require('../middleware/activeSession');
const fail=(res,error,status=400)=>res.status(status).json({ok:false,error});
const cleanNext=raw=>typeof raw==='string'&&raw.startsWith('/')&&!raw.startsWith('//')&&!raw.startsWith('/\\')&&!/\r|\n/.test(raw)&&raw.length<200?raw:'/profile';
const safeError=(e,defaultText)=>e?.code?.startsWith('08')?defaultText:(e?.message||defaultText);
async function register(req,res){
 try{
  // Los campos ya pasaron por express-validator (validations/userValidations.js).
  const user=await model.register(req.body);
  await session.login(req,res,user,false);
  return res.status(201).json({ok:true,user,redirect:'/profile'});
 }catch(e){if(e.code)console.error('Registro:',e.message);return fail(res,e.code?'No pudimos crear tu cuenta. Intenta nuevamente.':e.message,e.message.startsWith('Ya existe')?409:400);}
}
async function login(req,res){
 try{
  const user=await model.authenticate(req.body.email,req.body.password);
  // El correo ya se validó como existente: si no autentica, la contraseña no coincide.
  if(!user)return res.status(401).json({ok:false,error:'La contraseña no es correcta.',errors:{password:'La contraseña no es correcta.'}});
  const remember=req.body.remember===true||req.body.remember==='on';
  await session.login(req,res,user,remember);
  return res.json({ok:true,user,redirect:cleanNext(req.body.next)});
 }catch(e){console.error('Login:',e.message);return fail(res,'No pudimos iniciar la sesión. Intenta nuevamente.',503);}
}
async function logout(req,res){await session.logout(req,res);return res.json({ok:true,redirect:'/login'});}
function sessionInfo(req,res){res.set('Cache-Control','no-store');return res.json({ok:true,user:req.customer||null});}
function profile(req,res){res.set('Cache-Control','no-store');return res.json({ok:true,user:req.customer});}
async function updateProfile(req,res){
 try{const user=await model.updateProfile(req.customer.id,req.body);res.set('Cache-Control','no-store');return res.json({ok:true,user,message:'Tu información se actualizó correctamente.'});}
 catch(err){if(err.code)console.error('Perfil:',err.message);return fail(res,err.code?'No pudimos guardar los cambios.':err.message,err.message.includes('existe')?409:400);}
}
async function updatePassword(req,res){
 try{
  await model.changePassword(req.customer.id,req.body.currentPassword,req.body.newPassword,req.body.confirmPassword);
  await session.revokeAll(req.customer.id);
  await session.logout(req,res);
  return res.json({ok:true,redirect:'/login',message:'Contraseña actualizada. Vuelve a iniciar sesión.'});
 }catch(err){if(err.code)console.error('Contraseña:',err.message);return fail(res,err.code?'No pudimos actualizar la contraseña.':err.message,400);}
}
module.exports={register,login,logout,sessionInfo,profile,updateProfile,updatePassword,cleanNext};
