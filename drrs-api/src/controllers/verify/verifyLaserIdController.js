const laserService = require('../../services/verify/verifyLaserIdService');
const veriryToken = require('../../utils/verifyToken');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'laserController' });

const verifyLaserIdController = async (req, res) => {
    try {
        const { citizenId, name, surname, dateOfBirth, laserCardId } = req.body;
        const token = req.headers["authorization"];

        logger.info(`token ${token}`)

        if (!veriryToken.verifyToken(token)) {
            return res.status(401).json({ status_flag: false, status_message: "unauthorized" });
        }

        if (!citizenId || !name || !surname || !dateOfBirth || !laserCardId) {
            logger.warn('ข้อมูล Request ไม่ครบถ้วน'); 
            return sendError(res, 'ข้อมูลไม่ถูกต้อง', 400); 
        }

        const result = await laserService.verifyLaserIdService(req.body);

        if (!result.success) {
            return res.status(200).json({
                status_flag: false,
                status_code: result.code,
                status_message: result.message,
                errors: result.errors || []
            });
        }

        return res.status(200).json({
            status_flag: true,
            status_code: result.code,
            status_message: result.message
        });

    } catch (error) {
        logger.error(`System Error: ${error.message}`);
        return sendError(res, 'เกิดข้อผิดพลาดในระบบ', 500);
    }
};

module.exports = { verifyLaserIdController };