const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');
const { requireAdminRole } = require('../middleware/requireAdminRole');
const { uploadXlsx } = require('../utils/uploadMemory');
const masterDataImportController = require('../controllers/admin/masterDataImportController');

router.post(
    '/admin/master/import',
    adminAuthMiddleware,
    requireAdminRole,
    uploadXlsx.fields([
        { name: 'province', maxCount: 1 },
        { name: 'district', maxCount: 1 },
        { name: 'subDistrict', maxCount: 1 },
    ]),
    masterDataImportController.importMasterData
);

module.exports = router;
