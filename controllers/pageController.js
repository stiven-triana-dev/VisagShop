'use strict';
const model=require('../models/activeProducts');
const money=value=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value);
const render=(view,pageTitle,extra={})=>(req,res)=>res.render(view,{pageTitle,...extra});
module.exports={
 async home(req,res){res.render('index',{pageTitle:'VisagShop · Viste a tu manera',isHome:true,products:await model.all(),money,pageScript:'catalog.js'});},
 async productDetail(req,res){const product=await model.find(String(req.query.id||''));res.status(product?200:404).render('products/detail',{pageTitle:product?`${product.nombre} | VisagShop`:'Producto no encontrado',product,money,pageScript:'detail.js'});},
 productCart:render('products/cart','Finalizar compra | VisagShop',{isCheckout:true,pageScript:'cart.js'}),
 register:render('users/register','Registro | VisagShop',{pageScript:'auth.js'}),
 login:render('users/login','Ingresar | VisagShop',{pageScript:'auth.js'}),
 recover:render('users/recover','Recuperar contraseña | VisagShop',{pageScript:'auth.js'}),
 async profile(req,res){
  const {money:formatMoney,date}=require('./orderController');
  const orders=await require('../models/activeOrders').listByUser(req.customer.id);
  res.set('Cache-Control','no-store');
  res.render('users/profile',{pageTitle:'Mi perfil | VisagShop',pageScript:'profile.js',orders,money:formatMoney,date});
 },
 notFound(req,res){res.status(404).render('404',{pageTitle:'Página no encontrada | VisagShop'});}
};
