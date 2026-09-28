const express = require('express');
const router = express.Router();
const utilController = require("../controllers/util/utilController");
const checkCloseSystemController = require("../controllers/util/checkCloseSystemController")
const healthCheckController = require("../controllers/util/healthCheckController")
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

// health check: เช็คว่า API + database พร้อมใช้งานไหม (GET /utils/health)
router.get('/healthCheck', healthCheckController.healthCheckController);

router.post('/encryption', utilController.encryptionController);
// /decryption ถูกปิด: เป็น decryption oracle ที่เปิดสาธารณะ และ frontend ไม่ได้เรียกใช้
// การถอดรหัสทำภายใน server เท่านั้น (ผ่าน utils/crypto โดยตรง)
router.post('/checkCloseSystem', checkCloseSystemController.checkCloseSystemController);

module.exports = router;