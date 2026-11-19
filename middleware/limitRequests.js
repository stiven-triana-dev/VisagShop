'use strict';
const buckets = new Map();
let requests = 0;
module.exports = function limitRequests({windowMs = 15*60*1000, max = 12, namespace = 'auth'} = {}) {
  return (req,res,next) => {
    const now = Date.now();
    if ((++requests % 500) === 0) for (const [key,bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${namespace}:${ip}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= now) bucket = {count:0,expires:now+windowMs};
    bucket.count++;
    buckets.set(key,bucket);
    if (bucket.count > max) {
      const seconds = Math.max(1, Math.ceil((bucket.expires-now)/1000));
      res.set('Retry-After', String(seconds));
      return res.status(429).json({ok:false,error:'Demasiados intentos. Espera unos minutos y vuelve a intentar.'});
    }
    next();
  };
};
