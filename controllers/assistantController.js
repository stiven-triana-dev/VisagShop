'use strict';
// Chat con VisagAssist: valida la pregunta y la reenvía con la identidad firmada.
const assistant=require('../services/visagAssist');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readQuestion(body){
 const mensaje=typeof body?.mensaje==='string'?body.mensaje.trim():'';
 const conversation=body?.conversacion_id;
 if(!mensaje||mensaje.length>500)return {error:'Escribe una pregunta de máximo 500 caracteres.'};
 if(conversation!=null&&conversation!==''&&!(typeof conversation==='string'&&UUID.test(conversation)))return {error:'Conversación inválida.'};
 return {mensaje,conversacion_id:conversation||null};
}
function fail(res,err){
 if(!(err instanceof assistant.AssistantError))throw err;
 if(err.retryAfter)res.set('Retry-After',String(err.retryAfter));
 return res.status(err.status).json({ok:false,error:err.message});
}
const disabled=res=>res.status(503).json({ok:false,error:'El asistente no está disponible en este momento.'});

function chat({admin=false}={}){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!assistant.enabled())return disabled(res);
  const question=readQuestion(req.body);
  if(question.error)return res.status(400).json({ok:false,error:question.error});
  try{return res.json({ok:true,...await assistant.ask(req,question,{admin})});}
  catch(err){return fail(res,err);}
 };
}
async function wake(req,res){
 res.set('Cache-Control','no-store');
 if(!assistant.enabled())return disabled(res);
 try{return res.json(await assistant.wake());}
 catch(err){return fail(res,err);}
}
module.exports={chat,wake,readQuestion};
