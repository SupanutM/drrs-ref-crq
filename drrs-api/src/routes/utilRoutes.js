const express = require('express');
const router = express.Router();
const utilController = require("../controllers/util/utilController");
const checkCloseSystemController = require("../controllers/util/checkCloseSystemController")
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

router.post('/encryption', utilController.encryptionController);
// /decryption ถูกปิด: เป็น decryption oracle ที่เปิดสาธารณะ และ frontend ไม่ได้เรียกใช้
// การถอดรหัสทำภายใน server เท่านั้น (ผ่าน utils/crypto โดยตรง)
router.post('/checkCloseSystem', checkCloseSystemController.checkCloseSystemController);

module.exports = router;