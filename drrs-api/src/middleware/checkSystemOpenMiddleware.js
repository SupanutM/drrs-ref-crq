const { checkCloseSystemService } = require('../services/util/checkCloseSystem');
const baseLogger = require('../utils/logger');
const logger = baseLogger.child({ context: 'checkSystemOpenMiddleware' });

// channel เดียวกับที่ frontend ส่งให้ /api/checkCloseSystem (ดู src/api/master.js ฝั่ง drrs)
const CHANNEL = 'DRRS';

/**
 * บังคับให้ทุก request ที่แตะ flow ของลูกค้า (verify, customer, debt-restructure, register, pdf)
 * ต้องผ่านการเช็คสถานะเปิด/ปิดระบบจาก tbl_settings_app ก่อนเสมอ
 * กันเคส session/token ที่ออกไว้ก่อนหน้ายังใช้งาน flow ต่อได้ทั้งที่ระบบถูกปิดไปแล้ว
 * (ฝั่ง frontend เช็คแค่ตอนโหลดหน้า consent เท่านั้น ไม่ครอบทั้งแอป)
 *
 * fail-safe: ถ้าเช็คสถานะไม่ได้ (DB error) หรือไม่พบ config ของ channel นี้ ให้ถือว่าปิดระบบ
 */
async function checkSystemOpenMiddleware(req, res, next) {
    try {
        const result = await checkCloseSystemService(CHANNEL);
        const isOpen = !!(result?.status && result?.data?.length > 0 && result.data[0].status_flag);

        if (!isOpen) {
            return res.status(503).json({
                status_flag: false,
                status_message: 'ระบบปิดให้บริการชั่วคราว กรุณาลองใหม่อีกครั้ง',
            });
        }

        return next();
    } catch (error) {
        logger.error(`checkSystemOpenMiddleware error: ${error.message}`);
        return res.status(503).json({
            status_flag: false,
            status_message: 'ระบบปิดให้บริการชั่วคราว กรุณาลองใหม่อีกครั้ง',
        });
    }
}

module.exports = { checkSystemOpenMiddleware };
