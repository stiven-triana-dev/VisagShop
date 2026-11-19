'use strict';
module.exports=function writeOrigin(req,res,next){
  const origin=req.get('Origin');
  const referer=req.get('Referer');
  const claimed=origin || referer;
  const expectedHost=req.get('host');
  if(claimed){
    try {
      const url=new URL(claimed);
      if(url.host!==expectedHost || (url.protocol!=='http:'&&url.protocol!=='https:'))
        return res.status(403).json({ok:false,error:'Origen de solicitud no autorizado.'});
    }catch {return res.status(403).json({ok:false,error:'Origen inválido.'});}
  }else if(process.env.NODE_ENV==='production'){
    return res.status(403).json({ok:false,error:'Solicitud sin origen verificado.'});
  }
  next();
};
