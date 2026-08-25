const express = require('express');
const router = express.Router();
const saveController = require('../controllers/debtRestructure/saveDebtRestructureController');
const cancelController = require('../controllers/debtRestructure/cancelDebtRestructureController');
const checkPlanController = require('../controllers/plan/checkPlanController');
const updateIncomeController = require('../controllers/debtRestructure/updateIncomeController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/debt-restructure', authMiddleware, systemLogMiddleware('save-debt-restructure', 'saveDebtRestructureController'), saveController.saveDebtRestructureController);
router.post('/cancel-plan', authMiddleware, systemLogMiddleware('cancel-debt-restructure', 'cancelDebtRestructureController'), cancelController.cancelDebtRestructureController);
router.post('/check-plan', authMiddleware, systemLogMiddleware('select-plan', 'checkPlanController'), checkPlanController.checkPlanController);
router.post('/update-income', authMiddleware, updateIncomeController.updateIncomeController);

module.exports = router;