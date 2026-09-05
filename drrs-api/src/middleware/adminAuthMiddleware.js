const { verifyAdminSession } = require('../utils/jwt');
const baseLogger = require('../utils/logger');
const logger = baseLogger.child({ context: 'adminAuthMiddleware' });

/**
 * บังคับให้ request แนบ admin session token (JWT) ที่ออกตอน login AD สำเร็จ
 * แยกจาก authMiddleware ของ customer เด็ดขาด — ใช้ secret คนละตัว (jwtAdminSecret)
 * ถ้าผ่าน จะแนบ req.admin = { username, role }
 * (role='ADMIN' ถ้ามีแถวใน tbl_admin_user เท่านั้น — ผู้ใช้ทั่วไป role=null ไม่มีแถวในตารางนี้เลย)
 * ใช้กับทุก route ภายใต้ /admin ที่ต้อง login แล้วเท่านั้น (import master/target data, reprint สัญญา)
 */
function adminAuthMiddleware(req, res, next) {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ success: false, message: 'unauthorized' });
    }

    try {
        const payload = verifyAdminSession(parts[1]);
        req.admin = {
            username: payload.username,
            role: payload.role,
        };
        return next();
    } catch (error) {
        logger.warn(`Invalid or expired admin session token: ${error.message}`);
        return res.status(401).json({ success: false, message: 'unauthorized' });
    }
}

module.exports = { adminAuthMiddleware };
