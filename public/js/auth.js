(() => {
 'use strict';
 const form=document.getElementById('demo-form');if(!form)return;
 const {attach,rules:r,readImage}=window.VisagValidate;
 const message=document.getElementById('form-message');
 const nextField=document.getElementById('auth-next');
 const next=new URLSearchParams(location.search).get('next');
 if(nextField && next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\'))nextField.value=next;
 const mode=form.dataset.mode;

 // Sprint 7: reglas del navegador (las mismas que valida el servidor).
 const fieldRules={
  register:{
   firstName:[r.required('El nombre es obligatorio.'),r.minLength(2,'El nombre debe tener al menos 2 caracteres.')],
   lastName:[r.required('El apellido es obligatorio.'),r.minLength(2,'El apellido debe tener al menos 2 caracteres.')],
   email:[r.required('El correo electrónico es obligatorio.'),r.email('Ingresa un correo válido (ejemplo@correo.com).')],
   password:[r.password()],
   confirm:[r.required('Confirma la contraseña.'),r.sameAs('password','Las contraseñas no coinciden.')],
   avatar:[r.image()]
  },
  login:{
   email:[r.required('El correo electrónico es obligatorio.'),r.email('Ingresa un correo válido (ejemplo@correo.com).')],
   password:[r.required('La contraseña es obligatoria.')]
  },
  recover:{
   email:[r.required('El correo electrónico es obligatorio.'),r.email('Ingresa un correo válido (ejemplo@correo.com).')]
  }
 }[mode];
 const validator=attach(form,fieldRules);

 // Vista previa de la foto de perfil.
 const avatarInput=form.elements.avatar,avatarPreview=document.getElementById('avatar-preview');
 avatarInput?.addEventListener('change',()=>{
  const file=avatarInput.files[0];
  if(avatarPreview.dataset.url)URL.revokeObjectURL(avatarPreview.dataset.url);
  if(!file||r.image()(file)){avatarPreview.hidden=true;return;}
  avatarPreview.dataset.url=URL.createObjectURL(file);avatarPreview.src=avatarPreview.dataset.url;avatarPreview.hidden=false;
 });

 const say=(text,color)=>{message.style.color=color;message.textContent=text;};
 form.addEventListener('submit',async event=>{
  event.preventDefault();message.textContent='';
  if(!validator.validate()){say('Revisa los campos marcados.','#bb3434');return;}
  if(mode==='recover'){say('La recuperación automática por correo aún no está habilitada. Escríbenos por WhatsApp y te ayudamos.','#885e28');return;}
  const body={};
  for(const [key,value] of new FormData(form).entries())if(typeof value==='string')body[key]=value;
  if(mode==='login')body.remember=Boolean(form.elements.remember?.checked);
  const button=form.querySelector('[type=submit]');button.disabled=true;
  say(mode==='register'?'Creando tu cuenta…':'Comprobando tus datos…','#666');
  try {
   if(mode==='register'&&avatarInput?.files[0])body.imageData=await readImage(avatarInput.files[0]);
   const response=await fetch(`/api/account/${mode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){
    if(data.errors&&data.errors.imageData)data.errors.avatar=data.errors.imageData;
    validator.showServerErrors(data.errors);
    throw new Error(data.error||'No se pudo completar la operación.');
   }
   say(mode==='register'?'¡Listo! Tu cuenta fue creada.':'¡Hola de nuevo! Entrando…','#246a3a');
   location.assign(data.redirect||'/');
  }catch(e){say(e.message,'#bb3434');}
  finally{button.disabled=false;}
 });
})();
