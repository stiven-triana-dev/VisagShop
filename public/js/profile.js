(() => {
 'use strict';
 const {attach,rules:r}=window.VisagValidate;
 async function submitJson(form,validator,path,method,message){
  const button=form.querySelector('[type="submit"]');
  message.textContent='Guardando…';message.className='profile-response';
  button.disabled=true;
  try{
   const body=Object.fromEntries(new FormData(form).entries());
   const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){validator.showServerErrors(data.errors);throw new Error(data.error||'No fue posible guardar los cambios.');}
   message.className='profile-response is-success';message.textContent=data.message||'Cambios guardados.';
   if(data.redirect){setTimeout(()=>location.assign(data.redirect),900);}
   else if(data.user){
    document.querySelector('.profile-identity strong').textContent=data.user.firstName+' '+data.user.lastName;
    document.querySelector('.profile-identity small').textContent=data.user.email;
    const avatar=document.querySelector('.profile-avatar');
    if(!avatar.querySelector('img'))avatar.textContent=(data.user.firstName.charAt(0)+data.user.lastName.charAt(0)).toUpperCase();
   }
   if(path.endsWith('/password'))form.reset();
  }catch(error){message.className='profile-response is-error';message.textContent=error.message;}
  finally{button.disabled=false;}
 }

 // Sprint 7: mismas reglas que valida el servidor.
 const personal=document.querySelector('#profile-form');
 if(personal){
  const validator=attach(personal,{
   firstName:[r.required('El nombre es obligatorio.'),r.minLength(2,'El nombre debe tener al menos 2 caracteres.')],
   lastName:[r.required('El apellido es obligatorio.'),r.minLength(2,'El apellido debe tener al menos 2 caracteres.')],
   email:[r.required('El correo electrónico es obligatorio.'),r.email('Ingresa un correo válido (ejemplo@correo.com).')],
   phone:[r.pattern(/^[+0-9 ()-]{7,25}$/,'Ingresa un teléfono válido (solo números, espacios, +, - o paréntesis).')]
  });
  personal.addEventListener('submit',event=>{event.preventDefault();if(validator.validate())submitJson(personal,validator,'/api/account/profile','PUT',document.querySelector('#profile-response'));});
 }
 const password=document.querySelector('#password-form');
 if(password){
  const validator=attach(password,{
   currentPassword:[r.required('Escribe tu contraseña actual.')],
   newPassword:[r.password(),r.differentFrom('currentPassword','La contraseña nueva debe ser diferente a la actual.')],
   confirmPassword:[r.required('Confirma la contraseña nueva.'),r.sameAs('newPassword','Las contraseñas nuevas no coinciden.')]
  });
  password.addEventListener('submit',event=>{event.preventDefault();if(validator.validate())submitJson(password,validator,'/api/account/password','PUT',document.querySelector('#password-response'));});
 }
 document.querySelector('#cerrar-sesion-perfil')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{const response=await fetch('/api/account/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw new Error('No fue posible cerrar sesión.');location.assign('/login');}
  catch(error){button.disabled=false;window.Visag?.notify?.(error.message);}
 });
})();
