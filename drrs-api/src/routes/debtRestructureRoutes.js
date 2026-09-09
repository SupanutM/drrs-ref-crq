const express = require('express');
const router = express.Router();
const saveController = require('../controllers/debtRestructure/saveDebtRestructureController');
const cancelController = require('../controllers/debtRestructure/cancelDebtRestructureController');
const checkPlanController = require('../controllers/plan/checkPlanController');
const updateIncomeController = require('../controllers/debtRestructure/updateIncomeController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkSystemOpenMiddleware } = require('../middleware/checkSystemOpenMiddleware');

router.post('/debt-restructure', checkSystemOpenMiddleware, authMiddleware, systemLogMiddleware('SAVE_PLAN', 'saveDebtRestructureController'), saveController.saveDebtRestructureController);
router.post('/cancel-plan', checkSystemOpenMiddleware, authMiddleware, systemLogMiddleware('CANCEL_PLAN', 'cancelDebtRestructureController'), cancelController.cancelDebtRestructureController);
router.post('/check-plan', checkSystemOpenMiddleware, authMiddleware, systemLogMiddleware('SELECT_PLAN', 'checkPlanController'), checkPlanController.checkPlanController);
router.post('/update-income', checkSystemOpenMiddleware, authMiddleware, updateIncomeController.updateIncomeController);

module.exports = router;