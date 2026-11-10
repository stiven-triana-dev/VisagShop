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

// Rutas REST y método HTTP indicados en Sprint 4.
// Listado y buscador: /products?q=jean&categoria=Pantalones
router.get('/',wrap(async (req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,80):'';
  const categoria=products.categories.includes(req.query.categoria)?req.query.categoria:'';
  const list=q||categoria?await products.search({q,categoria}):await products.all();
  res.render('products/list',{pageTitle:q?`Buscar “${q}” | VisagShop`:'Colección | VisagShop',products:list,money,q,categoria,categories:products.categories,pageScript:'productList.js',isHome:false});
}));
router.get('/create',requireAdmin,wrap(admin.newForm));
router.post('/',mutationLimit,requireAdmin,sameOrigin,validate(rules.create),wrap(admin.create));
router.get('/:id/edit',requireAdmin,wrap(admin.editForm));
router.get('/:id',wrap(async (req,res)=>{
  const product=await products.find(req.params.id);
  if(!product)return res.status(404).render('404',{pageTitle:'Producto no encontrado | VisagShop'});
  res.render('products/detail',{pageTitle:`${product.nombre} | VisagShop`,product,money,pageScript:'detail.js'});
}));
router.put('/:id',mutationLimit,requireAdmin,sameOrigin,validate(rules.update),wrap(admin.update));
router.delete('/:id',mutationLimit,requireAdmin,sameOrigin,wrap(admin.remove));
module.exports=router;
