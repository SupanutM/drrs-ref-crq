const { verifySession } = require('../utils/jwt');
const baseLogger = require('../utils/logger');
const logger = baseLogger.child({ context: 'authMiddleware' });

/**
 * บังคับให้ request แนบ session token (JWT) ที่ออกตอน verify สำเร็จ
 * ถ้าผ่าน จะแนบ req.auth = { cusTargetId, accountNos }
 * ใช้กับ route ที่ต้องยืนยันตัวตนแล้วเท่านั้น
 */
function authMiddleware(req, res, next) {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ status_flag: false, status_message: 'unauthorized' });
    }

    try {
        const payload = verifySession(parts[1]);
        req.auth = {
            cusTargetId: payload.cusTargetId,
            accountNos: Array.isArray(payload.accountNos) ? payload.accountNos : [],
        };
        return next();
    } catch (error) {
        logger.warn(`Invalid or expired session token: ${error.message}`);
        return res.status(401).json({ status_flag: false, status_message: 'unauthorized' });
    }
}

/**
 * เช็กว่า accountNo ที่ request อ้างถึง เป็นของเจ้าของ session จริง (กัน IDOR)
 * คืน true ถ้าเป็นเจ้าของ
 */
function ownsAccount(req, accountNo) {
    return !!req.auth && req.auth.accountNos.includes(accountNo);
}

module.exports = {
    authMiddleware,
    ownsAccount,
};
