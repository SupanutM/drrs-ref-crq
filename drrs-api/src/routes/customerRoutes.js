const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer/customerController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkSystemOpenMiddleware } = require('../middleware/checkSystemOpenMiddleware');

router.post('/customer/lookup', checkSystemOpenMiddleware, authMiddleware, customerController.lookupCustomer);
router.put('/customer/address', checkSystemOpenMiddleware, authMiddleware, customerController.updateCustomerAddress);

module.exports = router;
