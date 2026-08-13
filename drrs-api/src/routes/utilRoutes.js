const express = require('express');
const router = express.Router();
const utilController = require("../controllers/util/utilController");
const checkCloseSystemController = require("../controllers/util/checkCloseSystemController")
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

router.post('/encryption', utilController.encryptionController);
router.post('/decryption', utilController.decryptionController);
router.post('/checkCloseSystem', checkCloseSystemController.checkCloseSystemController);

module.exports = router;