const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer/customerController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/customer/lookup', authMiddleware, customerController.lookupCustomer);
router.put('/customer/address', authMiddleware, customerController.updateCustomerAddress);

module.exports = router;
