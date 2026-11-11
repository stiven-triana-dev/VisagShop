'use strict';
// Pedidos desde el carrito: POST /api/orders
const express = require('express');
const controller = require('../controllers/orderController');
const sameOrigin = require('../middleware/writeOrigin');
const limitRequests = require('../middleware/limitRequests');
const validate = require('../middleware/validate');
const rules = require('../validations/orderValidations');
const wrap = require('../middleware/asyncHandler');

const router = express.Router();
const orderLimit = limitRequests({max: 10, windowMs: 60 * 60 * 1000, namespace: 'orders'});
router.post('/', orderLimit, sameOrigin, validate(rules.create), wrap(controller.create));
module.exports = router;
