const express = require('express');
const router = express.Router();
const saveController = require('../controllers/debtRestructure/saveDebtRestructureController');
const cancelController = require('../controllers/debtRestructure/cancelDebtRestructureController');
const checkPlanController = require('../controllers/plan/checkPlanController');
const updateIncomeController = require('../controllers/debtRestructure/updateIncomeController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

router.post('/debt-restructure', systemLogMiddleware('save-debt-restructure', 'saveDebtRestructureController'), saveController.saveDebtRestructureController);
router.post('/cancel-plan', systemLogMiddleware('cancel-debt-restructure', 'cancelDebtRestructureController'), cancelController.cancelDebtRestructureController);
router.post('/check-plan', systemLogMiddleware('select-plan', 'checkPlanController'), checkPlanController.checkPlanController);
router.post('/update-income', updateIncomeController.updateIncomeController);

module.exports = router;