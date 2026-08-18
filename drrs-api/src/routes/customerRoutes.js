const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer/customerController');

router.post('/customer/lookup', customerController.lookupCustomer);
router.put('/customer/address', customerController.updateCustomerAddress);

module.exports = router;
