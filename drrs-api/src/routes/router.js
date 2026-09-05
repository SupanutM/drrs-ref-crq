const express = require('express');
const router = express.Router();

const verify = require('./verifyRoutes');
const generateConsent = require('./pdfRoutes');
const debtRestructureRoutes = require('./debtRestructureRoutes');
const utilRoutesRoutes = require('./utilRoutes');
const customerRoutes = require('./customerRoutes');
const masterDataRoutes = require('./masterDataRoutes');
const registerRoutes = require('./registerRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const adminMasterDataRoutes = require('./adminMasterDataRoutes');
const adminTargetDataRoutes = require('./adminTargetDataRoutes');
const adminContractReprintRoutes = require('./adminContractReprintRoutes');
const adminUserManageRoutes = require('./adminUserManageRoutes');

// 2. นำ Routes มาต่อเข้ากับตัวกระจายทาง
router.use('/', verify); 
router.use('/', generateConsent);       
router.use('/', debtRestructureRoutes);       
router.use('/', utilRoutesRoutes);       
router.use('/', customerRoutes);
router.use('/', masterDataRoutes);
router.use('/', registerRoutes);
router.use('/', adminAuthRoutes);
router.use('/', adminMasterDataRoutes);
router.use('/', adminTargetDataRoutes);
router.use('/', adminContractReprintRoutes);
router.use('/', adminUserManageRoutes);

module.exports = router;