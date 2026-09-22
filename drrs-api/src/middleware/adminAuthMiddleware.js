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
        // เดิมทางนี้ return 401 เงียบๆ ไม่ log อะไรเลย ทำให้เวลาเจอ 401 แยกไม่ออกว่าเป็นเพราะ
        // "ไม่ได้แนบ token มา" หรือ "token หมดอายุ/ไม่ถูกต้อง" — ต้อง log ไว้เสมอ
        const headerState = header ? 'รูปแบบ header ไม่ถูกต้อง (ต้องเป็น "Bearer <token>")' : 'ไม่มี header authorization';
        logger.warn(`401 ไม่ผ่าน admin auth: ${headerState} — ${req.method} ${req.originalUrl}`);
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
        // แยกเคสด้วย error.name ของ jsonwebtoken เพื่อให้ไล่สาเหตุ 401 ได้จาก log บรรทัดเดียว:
        //   TokenExpiredError  = token หมดอายุตามปกติ (JWT_ADMIN_EXPIRES_IN) -> ให้ login ใหม่
        //   JsonWebTokenError  = ลายเซ็นไม่ตรง/token เพี้ยน ส่วนใหญ่คือ JWT_ADMIN_SECRET ถูกเปลี่ยน
        //                        หลังจากออก token ใบนั้นไปแล้ว (token เก่าใน sessionStorage ใช้ไม่ได้อีก)
        const isExpired = error.name === 'TokenExpiredError';
        const reason = isExpired
            ? `token หมดอายุ (expiredAt=${error.expiredAt?.toISOString?.() ?? error.expiredAt})`
            : `token ไม่ถูกต้อง (${error.name}: ${error.message})`;
        logger.warn(`401 ไม่ผ่าน admin auth: ${reason} — ${req.method} ${req.originalUrl}`);

        // แยกข้อความตอบกลับเฉพาะเคสหมดอายุ ให้หน้าเว็บบอกผู้ใช้ได้ว่าต้อง login ใหม่ (ไม่ใช่เด้ง
        // กลับหน้า login เฉยๆ โดยไม่บอกเหตุผล) เคสอื่นคงข้อความกลางๆ ไม่บอกรายละเอียดออกไป
        return res.status(401).json({
            success: false,
            message: isExpired ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'unauthorized',
        });
    }
}

module.exports = { adminAuthMiddleware };
