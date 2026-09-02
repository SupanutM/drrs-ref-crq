const { inquiryAccountService } = require('../../services/register/inquiryAccountService');
const { ownsAccount } = require('../../middleware/authMiddleware');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'inquiryAccountController' });

const inquiryAccountController = async (req, res) => {
    try {
        const { accountNo, source, planNo } = req.body;

        if (!accountNo) {
            return sendError(res, 'กรุณาระบุเลขที่บัญชี (accountNo)', 400);
        }

        // เช็กว่า accountNo เป็นของเจ้าของ session จริง (กัน IDOR)
        if (!ownsAccount(req, accountNo)) {
            logger.warn(`[IDOR Block] accountNo ${accountNo} ไม่ได้เป็นของ session นี้`);
            return sendError(res, 'ไม่มีสิทธิ์ดำเนินการกับบัญชีนี้', 403);
        }

        const result = await inquiryAccountService({ accountNo, source, planNo });

        if (!result.success) {
            const statusCode = result.status && result.status < 500 ? result.status : 502;
            return res.status(statusCode).json({
                success: false,
                message: result.message,
            });
        }

        return sendSuccess(res, 'ตรวจสอบข้อมูลบัญชีสำเร็จ', result.data);
    } catch (error) {
        logger.error(`[inquiryAccountController] System Error: ${error.message}`);
        return sendError(res, 'เกิดข้อผิดพลาดในระบบ', 500, error);
    }
};

module.exports = { inquiryAccountController };
