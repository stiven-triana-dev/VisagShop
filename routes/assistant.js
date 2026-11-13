'use strict';
// Rutas del asistente para la tienda (invitados y clientes). Las del administrador
// están en routes/admin.js, detrás del usuario y la clave del panel.
const express=require('express');
const controller=require('../controllers/assistantController');
const sameOrigin=require('../middleware/writeOrigin');
const limitRequests=require('../middleware/limitRequests');
const wrap=require('../middleware/asyncHandler');
const router=express.Router();
router.use(limitRequests({max:60,windowMs:15*60*1000,namespace:'asistente'}));
router.get('/estado',wrap(controller.wake));
router.post('/chat',sameOrigin,wrap(controller.chat()));
module.exports=router;
