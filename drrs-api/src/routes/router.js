const express = require('express');
const router = express.Router();

const verify = require('./verifyRoutes');
const generateConsent = require('./pdfRoutes');
const debtRestructureRoutes = require('./debtRestructureRoutes');
const utilRoutesRoutes = require('./utilRoutes');

// 2. นำ Routes มาต่อเข้ากับตัวกระจายทาง
router.use('/', verify); 
router.use('/', generateConsent);       
router.use('/', debtRestructureRoutes);       
router.use('/', utilRoutesRoutes);       

module.exports = router;