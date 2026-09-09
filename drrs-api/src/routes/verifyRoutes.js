const express = require('express');
const router = express.Router();
const verifyController = require('../controllers/verify/verifyController');
const verifyCusTarget = require('../controllers/verify/verifyCusTargetController');
const verifyLaserId = require('../controllers/verify/verifyLaserIdController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');
const { checkSystemOpenMiddleware } = require('../middleware/checkSystemOpenMiddleware');

// main verify
router.post('/verify-register', checkSystemOpenMiddleware, systemLogMiddleware('VERIFY_REGISTER', 'verifyController'), verifyController.verifyController);
// เส้นแยกของการเช็คที่ละขั้นตอน
router.post('/verify-cus-target', checkSystemOpenMiddleware, verifyCusTarget.verifyCusTargetController);
router.post('/verify-laser-id', checkSystemOpenMiddleware, verifyLaserId.verifyLaserIdController);

module.exports = router;