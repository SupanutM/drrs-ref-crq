const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');
const { requireAdminRole } = require('../middleware/requireAdminRole');
const { uploadCsvOnly } = require('../utils/uploadMemory');
const targetDataImportController = require('../controllers/admin/targetDataImportController');

router.post(
    '/admin/target/import',
    adminAuthMiddleware,
    requireAdminRole,
    uploadCsvOnly.fields([
        { name: 'customer', maxCount: 1 },
        { name: 'account', maxCount: 1 },
        { name: 'plan', maxCount: 1 },
    ]),
    targetDataImportController.importTargetData
);

module.exports = router;
