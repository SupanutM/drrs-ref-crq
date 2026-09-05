const baseLogger = require('../utils/logger');
const logger = baseLogger.child({ context: 'requireSuperAdminRole' });

/**
 * บังคับว่า req.admin.role ต้องเป็น 'SUPERADMIN' เท่านั้น — ใช้กับ endpoint จัดการสิทธิ์
 * ผู้ใช้ admin คนอื่น (หน้า user-management) สิทธิ์ระดับ ADMIN ธรรมดาทำไม่ได้ (กันคนถือสิทธิ์
 * import ข้อมูลไปตั้งตัวเองหรือคนอื่นเป็น ADMIN/SUPERADMIN เพิ่มเองได้)
 * ต้องเรียกต่อจาก adminAuthMiddleware เสมอ (ต้องมี req.admin ก่อนถึงจะเช็ค role ได้)
 */
function requireSuperAdminRole(req, res, next) {
    if (req.admin?.role !== 'SUPERADMIN') {
        logger.warn(`Access denied (ไม่มีสิทธิ์ SUPERADMIN): username=${req.admin?.username} role=${req.admin?.role}`);
        return res.status(403).json({
            success: false,
            message: 'ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็นผู้ดูแลระบบระดับ SUPERADMIN เท่านั้น)'
        });
    }
    return next();
}

module.exports = { requireSuperAdminRole };
