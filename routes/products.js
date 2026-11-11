'use strict';
const express=require('express');
const products=require('../models/activeProducts');
const admin=require('../controllers/adminController');
const requireAdmin=require('../middleware/adminAuth');
const sameOrigin=require('../middleware/writeOrigin');
const limitRequests=require('../middleware/limitRequests');
const mutationLimit=limitRequests({max:80,windowMs:15*60*1000,namespace:'product-write'});
const validate=require('../middleware/validate');
const rules=require('../validations/productValidations');
const router=express.Router();
const wrap=require('../middleware/asyncHandler');
const money=value=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
// Vista previa del enlace de un producto: su foto, precio y tallas.
function productMeta(p){
  const parts=[Number.isFinite(p.precio)?money(p.precio):'Precio por consultar'];
  if(p.tallas?.length)parts.push(`Tallas: ${p.tallas.join(', ')}`);
  if(p.colores?.length)parts.push(`Colores: ${p.colores.join(', ')}`);
  return {metaDescription:`${parts.join(' · ')}. ${p.descripcion||`${p.categoria} de ropa urbana en VisagShop. Pide por WhatsApp.`}`.slice(0,300),ogImage:p.imagen,ogType:'product'};
}

// Rutas REST y método HTTP indicados en Sprint 4.
// Listado, buscador y paginación: /products?q=jean&categoria=Pantalones&page=2
const PAGE_SIZE=24;
router.get('/',wrap(async (req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,80):'';
  const categoria=products.categories.includes(req.query.categoria)?req.query.categoria:'';
  const list=q||categoria?await products.search({q,categoria}):await products.all();
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  const page=Math.min(pages,Math.max(1,Number.parseInt(req.query.page,10)||1));
  // Enlace a otra página conservando la búsqueda y la categoría.
  const pageLink=n=>{
    const query=new URLSearchParams({...(q?{q}:{}),...(categoria?{categoria}:{}),...(n>1?{page:String(n)}:{})}).toString();
    return query?`/products?${query}`:'/products';
  };
  const title=(q?`Buscar “${q}”`:categoria||'Colección')+(page>1?` · Página ${page}`:'')+' | VisagShop';
  res.render('products/list',{
    pageTitle:title,products:list.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),total:list.length,page,pages,pageLink,
    money,q,categoria,categories:products.categories,pageScript:'productList.js',isHome:false,
    ...(categoria?{metaDescription:`${categoria} de ropa urbana en VisagShop: ${list.length} referencias. Pide por WhatsApp desde Lebrija, Santander.`}:{})
  });
}));
router.get('/create',requireAdmin,wrap(admin.newForm));
router.post('/',mutationLimit,requireAdmin,sameOrigin,validate(rules.create),wrap(admin.create));
router.get('/:id/edit',requireAdmin,wrap(admin.editForm));
router.get('/:id',wrap(async (req,res)=>{
  const product=await products.find(req.params.id);
  if(!product)return res.status(404).render('404',{pageTitle:'Producto no encontrado | VisagShop'});
  res.render('products/detail',{pageTitle:`${product.nombre} | VisagShop`,product,money,pageScript:'detail.js',...productMeta(product)});
}));
router.put('/:id',mutationLimit,requireAdmin,sameOrigin,validate(rules.update),wrap(admin.update));
router.delete('/:id',mutationLimit,requireAdmin,sameOrigin,wrap(admin.remove));
module.exports=router;
