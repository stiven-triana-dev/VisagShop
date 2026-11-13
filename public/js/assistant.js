'use strict';
// Burbuja de chat de VisagAssist. Habla solo con el servidor de VisagShop (/api/asistente),
// que firma quién pregunta y reenvía la pregunta al asistente. Las respuestas se pintan con
// nodos de texto (nunca innerHTML): aunque el modelo devolviera HTML, no se ejecuta.
(()=>{
 const meta=document.querySelector('meta[name="visag-assistant"]');
 if(!meta)return;
 const endpoint=meta.content;
 const admin=endpoint.startsWith('/admin/');
 const storageKey=`visag-assistant:${endpoint}`;
 const suggestions=admin
  ?['¿Qué pedidos están pendientes?','¿Cómo van las ventas este mes?','¿Qué productos están incompletos?']
  :['¿Tienen gorras por menos de 60 mil?','¿Qué categorías manejan?','¿Cómo va mi pedido?'];
 const greeting=admin
  ?'Soy VisagAssist. Consulto pedidos pendientes, ventas y productos incompletos con los datos reales del panel.'
  :'Soy VisagAssist. Te ayudo a encontrar prendas por talla, precio o estilo, y a revisar tus pedidos.';

 let state={conversation:null,messages:[]};
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved&&Array.isArray(saved.messages))state=saved;}catch{}
 const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({conversation:state.conversation,messages:state.messages.slice(-30)}));}catch{}};

 const el=(tag,props={},...children)=>{
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(props)){
   if(key==='class')node.className=value;
   else if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
   else node.setAttribute(key,value);
  }
  node.append(...children);
  return node;
 };

 // Enlaces: solo http(s). Los de la tienda publicada se abren en este mismo sitio.
 function safeLink(raw,label){
  let url;
  try{url=new URL(raw,location.origin);}catch{return document.createTextNode(label);}
  if(!/^https?:$/.test(url.protocol))return document.createTextNode(label);
  const own=url.origin===location.origin||/(^|\.)visagshop\.onrender\.com$/.test(url.hostname);
  const href=own?url.pathname+url.search+url.hash:url.href;
  const link=el('a',{href},label);
  if(!own){link.target='_blank';link.rel='noopener noreferrer';}
  return link;
 }
 // Formato mínimo: **negrita**, `código`, [texto](url), direcciones sueltas y listas.
 const pattern=/\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])|\*\*([^*\n]{1,200})\*\*|`([^`\n]{1,80})`/g;
 function inline(text){
  const out=[];let last=0;
  for(const match of text.matchAll(pattern)){
   if(match.index>last)out.push(document.createTextNode(text.slice(last,match.index)));
   if(match[1])out.push(safeLink(match[2],match[1]));
   else if(match[3])out.push(safeLink(match[3],'Ver producto'));
   else if(match[4])out.push(el('strong',{},match[4]));
   else out.push(el('code',{},match[5]));
   last=match.index+match[0].length;
  }
  if(last<text.length)out.push(document.createTextNode(text.slice(last)));
  return out;
 }
 function formatted(text){
  const box=document.createDocumentFragment();let list=null;
  for(const line of String(text).split('\n')){
   const item=/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
   if(item){if(!list){list=el('ul');box.append(list);}list.append(el('li',{},...inline(item[1])));continue;}
   list=null;
   if(line.trim())box.append(el('p',{},...inline(line)));
  }
  return box;
 }

 const LOGO='/img/logo-visagshop-128.png';
 const logo=(cls,size)=>el('img',{class:cls,src:LOGO,alt:'',width:String(size),height:String(size),decoding:'async'});
 const log=el('div',{class:'va-log',role:'log','aria-live':'polite','aria-label':'Conversación con el asistente'});
 const status=el('p',{class:'va-status',role:'status'});
 const input=el('textarea',{class:'va-input',rows:'1',maxlength:'500',placeholder:admin?'Pregunta por pedidos o ventas…':'Busca prendas, tallas o tu pedido…','aria-label':'Tu pregunta'});
 const send=el('button',{class:'va-send',type:'submit','aria-label':'Enviar pregunta'},el('span',{'aria-hidden':'true'},'→'));
 const form=el('form',{class:'va-form'},input,send);
 const chips=el('div',{class:'va-chips','aria-label':'Preguntas sugeridas'},
  ...suggestions.map(text=>el('button',{type:'button',class:'va-chip',onclick:()=>ask(text)},el('span',{},text),el('b',{'aria-hidden':'true'},'↗'))));
 const reset=el('button',{type:'button',class:'va-icon',title:'Nueva conversación','aria-label':'Nueva conversación',onclick:restart},'↺');
 const close=el('button',{type:'button',class:'va-icon',title:'Cerrar','aria-label':'Cerrar asistente',onclick:()=>toggle(false)},'✕');
 const panel=el('section',{class:'va-panel',id:'va-panel',role:'dialog','aria-label':'Asistente VisagAssist',hidden:''},
  el('header',{class:'va-head'},
   el('span',{class:'va-head-mark'},logo('va-head-logo',44)),
   el('div',{class:'va-head-title'},
    el('strong',{},'Visag',el('em',{},'Assist')),
    el('small',{},el('i',{class:'va-dot','aria-hidden':'true'}),admin?'Asistente del panel · IA':'Asistente de la tienda · IA')),
   el('div',{class:'va-head-actions'},reset,close)),
  log,chips,status,form,
  el('p',{class:'va-note'},'Respuestas generadas con IA: pueden tener errores. Pagos y envíos se confirman por WhatsApp.'));
 const bubble=el('button',{type:'button',class:'va-bubble','aria-controls':'va-panel','aria-expanded':'false','aria-label':'Abrir el asistente de VisagShop',onclick:()=>toggle()},
  el('span',{class:'va-bubble-mark'},logo('va-bubble-logo',40)),
  el('span',{class:'va-bubble-text'},el('small',{},'Asistente IA'),el('strong',{},admin?'Pregúntale al panel':'Pregúntale a Visag')),
  el('span',{class:'va-bubble-close','aria-hidden':'true'},'✕'));
 document.body.append(panel,bubble);

 function welcome(){
  return el('div',{class:'va-welcome'},
   el('span',{class:'va-kicker'},admin?'Panel / Asistente':'VisagShop / Asistente'),
   el('h2',{},'Pregunta a tu ',el('em',{},'manera.')),
   el('p',{},greeting));
 }
 function bubbleOf(author,text){
  const node=el('div',{class:`va-msg va-${author}`});
  if(author==='bot')node.append(formatted(text));else node.textContent=text;
  return author==='bot'?el('div',{class:'va-row'},logo('va-avatar',26),node):node;
 }
 function render(){
  log.replaceChildren(...(state.messages.length?state.messages.map(m=>bubbleOf(m.author,m.text)):[welcome()]));
  chips.hidden=state.messages.length>0;
  log.scrollTop=log.scrollHeight;
 }
 function add(author,text){
  if(!state.messages.length)log.replaceChildren();
  state.messages.push({author,text});save();log.append(bubbleOf(author,text));chips.hidden=true;log.scrollTop=log.scrollHeight;
 }
 function restart(){state={conversation:null,messages:[]};save();status.textContent='';render();input.focus();}

 let woke=false;
 function wake(){
  if(woke)return;woke=true;
  fetch(endpoint+'/estado',{headers:{Accept:'application/json'},credentials:'same-origin'}).catch(()=>{woke=false;});
 }
 function toggle(open=panel.hidden){
  panel.hidden=!open;bubble.setAttribute('aria-expanded',String(open));bubble.classList.toggle('va-open',open);
  if(open){render();wake();input.focus();}else bubble.focus();
 }
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)toggle(false);});

 let busy=false;
 async function ask(text){
  const question=String(text||'').trim();
  if(!question||busy)return;
  if(question.length>500){status.textContent='Máximo 500 caracteres.';return;}
  busy=true;send.disabled=true;input.value='';autosize();
  add('user',question);
  const typing=el('div',{class:'va-row'},logo('va-avatar',26),el('div',{class:'va-msg va-bot va-typing','aria-label':'El asistente está escribiendo'},el('span'),el('span'),el('span')));
  log.append(typing);log.scrollTop=log.scrollHeight;
  status.textContent='';
  const slow=setTimeout(()=>{status.textContent='Despertando al asistente… la primera respuesta puede tardar hasta un minuto.';},6000);
  try{
   const response=await fetch(endpoint+'/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({mensaje:question,conversacion_id:state.conversation})});
   const data=await response.json().catch(()=>({}));
   if(response.status===404)state.conversation=null;
   if(!response.ok||!data.ok)throw new Error(data.error||'El asistente no está disponible en este momento.');
   state.conversation=data.conversacion_id;
   add('bot',data.respuesta);
   status.textContent='';
  }catch(err){
   status.textContent=err.message&&!/fetch|network/i.test(err.message)?err.message:'No hay conexión. Intenta de nuevo.';
  }finally{
   clearTimeout(slow);typing.remove();busy=false;send.disabled=false;save();input.focus();
  }
 }
 function autosize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight+2,120)+'px';input.style.overflowY=input.scrollHeight>118?'auto':'hidden';}
 input.addEventListener('input',autosize);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ask(input.value);}});
 form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
})();
