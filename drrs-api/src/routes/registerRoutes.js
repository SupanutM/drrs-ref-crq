const express = require('express');
const router = express.Router();
const inquiryAccountController = require('../controllers/register/inquiryAccountController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

// ตรวจสอบข้อมูลบัญชีสินเชื่อจาก CBS: gettoken (SSO) -> CBS_INQUIRY_ACCOUNT_URL
router.post(
    '/cbsregister/inquiry-account',
    authMiddleware,
    systemLogMiddleware('CBS_INQUIRY_ACCOUNT', 'inquiryAccountController'),
    inquiryAccountController.inquiryAccountController
);

module.exports = router;
