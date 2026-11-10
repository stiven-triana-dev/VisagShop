'use strict';
module.exports=process.env.DATABASE_URL?require('../database/repositories/products'):require('./productModel');
