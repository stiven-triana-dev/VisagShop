'use strict';
const express=require('express');
const path=require('node:path');
const app=express();
const pages=require('./routes/pages');
const admin=require('./routes/admin');
const productRoutes=require('./routes/products');
const accounts=require('./routes/accounts');
const products=require('./models/activeProducts');
const session=require('./middleware/activeSession');
const database=require('./database/setup');
const wrap=require('./middleware/asyncHandler');
const store=require('./storage');
const {notFound}=require('./controllers/pageController');
const PORT=Number(process.env.PORT)||3000;
const cloud=Boolean(process.env.DATABASE_URL);
const production=process.env.NODE_ENV==='production';
if(production&&!cloud)throw Error('No es seguro iniciar VisagShop en hosting gratuito sin DATABASE_URL de Neon.');
if(!cloud)store.setup();
// Versión de CSS/JS: huella del contenido de esos archivos. Va en sus URLs (?v=...),
// así el navegador puede guardarlos en caché y aun así recibe los cambios de cada despliegue.
const assetVersion=(()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),hash=crypto.createHash('sha1');
 for(const dir of ['css','js'])for(const name of fs.readdirSync(path.join(__dirname,'public',dir)).sort())hash.update(name).update(fs.readFileSync(path.join(__dirname,'public',dir,name)));
 return hash.digest('hex').slice(0,10);
})();
const DESCRIPTION='Ropa urbana al detal y por mayor desde Lebrija, Santander. Jeans, gorras, tenis y más; pide por WhatsApp.';
app.set('trust proxy',1);
app.disable('x-powered-by');
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');
app.use((req,res,next)=>{
 res.locals.isHome=false;res.locals.isCheckout=false;res.locals.isAdmin=false;res.locals.pageScript='';res.locals.pageTitle='VisagShop';
 res.locals.whatsappNumber=/^\d{8,15}$/.test(process.env.WHATSAPP_NUMBER||'')?process.env.WHATSAPP_NUMBER:'';
 // Datos para la vista previa al compartir un enlace (WhatsApp, Facebook...). Las páginas pueden cambiarlos.
 res.locals.assetVersion=assetVersion;
 res.locals.baseUrl=`${req.protocol}://${req.get('host')}`;
 res.locals.pageUrl=res.locals.baseUrl+req.originalUrl.split('?')[0];
 res.locals.metaDescription=DESCRIPTION;
 res.locals.ogImage='/img/p042.jpg';
 res.locals.ogType='website';
 res.set('X-Content-Type-Options','nosniff');
 res.set('Referrer-Policy','strict-origin-when-cross-origin');
 res.set('X-Frame-Options','DENY');
 res.set('X-Permitted-Cross-Domain-Policies','none');
 res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.set('Content-Security-Policy',"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; media-src 'self'");
 if(production)res.set('Strict-Transport-Security','max-age=31536000');
 next();
});
app.use(express.json({limit:'5mb',type:'application/json'}));
app.use(express.urlencoded({extended:false,limit:'100kb'}));
app.get('/health',wrap(async(req,res)=>{
 if(cloud)await database.ping();
 else{
  const fs=require('node:fs');fs.accessSync(path.join(store.dataDir,'products.json'),fs.constants.R_OK|fs.constants.W_OK);
  fs.accessSync(path.join(store.dataDir,'users.json'),fs.constants.R_OK|fs.constants.W_OK);
 }
 res.set('Cache-Control','no-store').json({status:'ok'});
}));
// Archivos públicos antes de identificar usuarios: evita consultas a Neon por cada
// CSS, JS y fotografía, importante para cuotas gratuitas.
if(cloud){
 app.get('/img/uploads/:filename',wrap(async(req,res)=>{
  const match=/^([a-f0-9-]{36})\.(?:jpg|png|webp|gif)$/.exec(req.params.filename);
  if(!match)return res.sendStatus(404);
  const file=await products.image(match[1]);
  if(!file)return res.sendStatus(404);
  res.set('Cache-Control','public, max-age=2592000, immutable'); // nombre único por foto
  res.type(file.mime).send(file.image_bytes);
 }));
}else app.use('/img/uploads',express.static(store.uploadDir,{index:false,dotfiles:'deny',maxAge:'30d',immutable:true}));
// Caché del navegador: CSS/JS pedidos con ?v=versión no cambian nunca (1 año);
// las fotos del catálogo, 7 días; el resto, 1 hora.
app.use(express.static(path.join(__dirname,'public'),{index:false,dotfiles:'deny',setHeaders(res,file){
 const req=res.req,versioned=/\.(css|js)$/.test(file)&&req.query.v===assetVersion;
 res.set('Cache-Control',versioned?'public, max-age=31536000, immutable':/\.(jpe?g|png|webp|gif|svg)$/i.test(file)?'public, max-age=604800':'public, max-age=3600');
}}));
app.use(session.attach);
app.get('/api/products',wrap(async(req,res)=>res.set('Cache-Control','no-store').json(await products.all())));
app.get('/api/products/:id',wrap(async(req,res)=>{
 const product=await products.find(req.params.id);
 if(!product)return res.status(404).json({ok:false,error:'Producto no encontrado.'});
 res.set('Cache-Control','no-store').json(product);
}));
app.get('/data/products.json',wrap(async(req,res)=>res.set('Cache-Control','no-store').json(await products.all())));
app.use('/api/account',accounts);
app.use('/admin',admin);
app.use('/products',productRoutes);
app.use('/',pages);
app.use(notFound);
app.use((err,req,res,next)=>{
 console.error(`Solicitud ${req.method} ${req.path}:`,err.message);
 if(res.headersSent)return next(err);
 const status=err.type==='entity.too.large'?413:503;
 if(req.path==='/health')return res.status(503).json({status:'unavailable'});
 if(req.path.startsWith('/api/')||['POST','PUT','DELETE'].includes(req.method))return res.status(status).json({ok:false,error:'Servicio temporalmente no disponible. Intenta de nuevo.'});
 res.status(status).type('text/plain').send('La tienda está temporalmente no disponible. Intenta nuevamente.');
});
async function start(){
 if(cloud)await database.initialize();
 return app.listen(PORT,'0.0.0.0',()=>console.log(`VisagShop: puerto ${PORT} (${cloud?'PostgreSQL con Sequelize':'JSON local'})`));
}
if(require.main===module)start().catch(err=>{console.error('Error al iniciar la tienda:',err.message);process.exitCode=1;});
module.exports={app,start};
