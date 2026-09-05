const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');
const contractReprintController = require('../controllers/admin/contractReprintController');

router.get('/admin/contract/search', adminAuthMiddleware, contractReprintController.searchContracts);
router.get('/admin/contract/:contractFileId/download', adminAuthMiddleware, contractReprintController.downloadContract);

module.exports = router;
