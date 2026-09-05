const baseLogger = require('../utils/logger');
const logger = baseLogger.child({ context: 'requireAdminRole' });

// สิทธิ์แบบลำดับชั้น — SUPERADMIN ทำทุกอย่างที่ ADMIN ทำได้ (ดู comment ใน entities/tblAdminUser.js)
const ALLOWED_ROLES = ['ADMIN', 'SUPERADMIN'];

/**
 * บังคับว่า req.admin.role ต้องเป็น 'ADMIN' หรือ 'SUPERADMIN' — ใช้กับ endpoint ที่แก้ไขข้อมูล
 * (import master data, import target data) ผู้ใช้ทั่วไป (role=NULL) ทำได้แค่ reprint สัญญา
 * ต้องเรียกต่อจาก adminAuthMiddleware เสมอ (ต้องมี req.admin ก่อนถึงจะเช็ค role ได้)
 */
function requireAdminRole(req, res, next) {
    if (!ALLOWED_ROLES.includes(req.admin?.role)) {
        logger.warn(`Access denied (ไม่มีสิทธิ์ ADMIN): username=${req.admin?.username} role=${req.admin?.role}`);
        return res.status(403).json({
            success: false,
            message: 'ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็นผู้ดูแลระบบระดับ ADMIN ขึ้นไปเท่านั้น)'
        });
    }
    return next();
}

module.exports = { requireAdminRole };
