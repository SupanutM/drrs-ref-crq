const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuthMiddleware');
const { requireSuperAdminRole } = require('../middleware/requireSuperAdminRole');
const adminUserManageController = require('../controllers/admin/adminUserManageController');

// จัดการสิทธิ์ผู้ใช้ admin (ให้/ถอด role ADMIN/SUPERADMIN, ระงับ/เปิดใช้งานบัญชี)
// ต้องเป็น SUPERADMIN เท่านั้น — ADMIN ธรรมดาเข้าหน้านี้ไม่ได้ (กันตั้งสิทธิ์ให้ตัวเอง/คนอื่นเอง)
router.get(
    '/admin/user-management',
    adminAuthMiddleware,
    requireSuperAdminRole,
    adminUserManageController.listAdminUsers
);

router.post(
    '/admin/user-management',
    adminAuthMiddleware,
    requireSuperAdminRole,
    adminUserManageController.addAdminUser
);

router.put(
    '/admin/user-management/:id',
    adminAuthMiddleware,
    requireSuperAdminRole,
    adminUserManageController.updateAdminUser
);

module.exports = router;
