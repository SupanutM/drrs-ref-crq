const { checkPlanService } = require('../../services/plan/checkPlanService');
const baseLogger = require('../../utils/logger');
const { ownsAccount } = require('../../middleware/authMiddleware');
const logger = baseLogger.child({ context: 'checkPlanController' });

const checkPlanController = async (req, res) => {
    try {
        const { accountNo, planNo } = req.body;
        // ดักเคสหน้าบ้านลืมส่ง planNo
        if (!planNo) {
            return res.status(400).json({
                status: false,
                message: "Bad Request: กรุณาระบุเลขที่แผน (planNo)"
            });
        }

        // เช็กว่า accountNo เป็นของเจ้าของ session จริง (กัน IDOR)
        if (accountNo && !ownsAccount(req, accountNo)) {
            logger.warn(`[IDOR Block] accountNo ${accountNo} ไม่ได้เป็นของ session นี้`);
            return res.status(403).json({ status: false, message: "ไม่มีสิทธิ์ดำเนินการกับบัญชีนี้" });
        }

        const result = await checkPlanService(planNo);
        // logger.info(`result plan: ${JSON.stringify(result)}`);

        // คืนค่ากลับไปให้หน้าบ้าน (HTTP 200 OK)
        return res.status(200).json(result);

    } catch (error) {
        // กรณีระบบมีปัญหา (HTTP 500 Internal Server Error)
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

module.exports = { checkPlanController };