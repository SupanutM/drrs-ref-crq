const baseLogger = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { AppDataSource } = require('../../config/database');
const createStepService = require('../../services/util/systemLog/createStepService');
const logger = baseLogger.child({ context: 'cancelDebtRestructureController' });

const cancelDebtRestructureController = async (req, res) => {
    try {
        const { accounts } = req.body;

        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return sendError(res, 'กรุณาส่งข้อมูลบัญชีที่ต้องการยกเลิกให้ครบถ้วน', 400);
        }

        const username = 'DRRS';

        for (const accountNo of accounts) {
            // Soft delete from drrs.tbl_account_installment
            await AppDataSource.query(`
                UPDATE drrs.tbl_account_installment 
                SET status = '0', delete_date = CURRENT_TIMESTAMP, delete_by = $1 
                WHERE account_no = $2 AND status = '1'
            `, [username, accountNo]);

            // Soft delete from drrs.tbl_account_hair_cut
            await AppDataSource.query(`
                UPDATE drrs.tbl_account_hair_cut 
                SET status = '0', delete_date = CURRENT_TIMESTAMP, delete_by = $1 
                WHERE account_no = $2 AND status = '1'
            `, [username, accountNo]);

            // Reset stepConfirmPlan to "0"
            logger.info(`[Step Log] Reset stepConfirmPlan: "0" สำหรับ AccountNo: ${accountNo}`);
            await createStepService.updateStepService(accountNo, { stepConfirmPlan: "0" }, 'cancel-plan');
        }

        return sendSuccess(res, 'ยกเลิกแผนสำเร็จ', null);

    } catch (error) {
        logger.error(`เกิดข้อผิดพลาดในการยกเลิกแผน: ${error.message}`);
        return sendError(res, 'ไม่สามารถยกเลิกแผนได้', 500, error);
    }
};

module.exports = {
    cancelDebtRestructureController
};
