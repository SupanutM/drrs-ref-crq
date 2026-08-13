const { checkPlanService } = require('../../services/plan/checkPlanService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'checkPlanController' });

const checkPlanController = async (req, res) => {
    try {
        logger.info(`Check Plan Controller: ${JSON.stringify(req.body)}`);
        const { accountNo, planNo } = req.body;
        logger.info(`accountNo: ${accountNo} planNo :${planNo}`);
        // ดักเคสหน้าบ้านลืมส่ง planNo
        if (!planNo) {
            return res.status(400).json({
                status: false,
                message: "Bad Request: กรุณาระบุเลขที่แผน (planNo)"
            });
        }

        const result = await checkPlanService(planNo);
        logger.info(`result plan: ${JSON.stringify(result)}`);

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