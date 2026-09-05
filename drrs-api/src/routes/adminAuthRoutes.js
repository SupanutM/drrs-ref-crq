const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/admin/adminAuthController');

router.post('/admin/login', adminAuthController.login);

module.exports = router;
