const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'verifyController' });
const verifyService = require('../../services/verify/verifyCusTargetService');

const verifyCusTargetController = async (req, res) => {
    try {
        const { target_id, verify_code } = req.body;

        if (!target_id || !verify_code) {
            logger.warn('Missing required parameters');
            return res.status(400).json({ success: false, message: 'กรุณาส่ง target_id และ verify_code ให้ครบถ้วน' });
        }

        logger.info(`Start verifying target ID: ${target_id}`);

        const result = await verifyService.verifyCustomerCode(target_id, verify_code);

        if (!result.success) {
            logger.info(`Verification failed for target ID: ${target_id} - ${result.message}`);
            return res.status(400).json({ success: false, message: result.message });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            customerInfo: result.data
        });

    } catch (error) {
        logger.error(`System error during verification: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' });
    }
};

module.exports = { verifyCusTargetController };