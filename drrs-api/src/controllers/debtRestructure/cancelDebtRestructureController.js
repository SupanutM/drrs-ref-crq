const baseLogger = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const { AppDataSource } = require('../../config/database');
const createStepService = require('../../services/util/systemLog/createStepService');
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
const logger = baseLogger.child({ context: 'cancelDebtRestructureController' });

const cancelDebtRestructureController = async (req, res) => {
    try {
        const { accounts } = req.body;

        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
            return sendError(res, 'กรุณาส่งข้อมูลบัญชีที่ต้องการยกเลิกให้ครบถ้วน', 400);
        }

        const username = 'DRRS';

        for (const accountNo of accounts) {
            // Soft delete from tbl_account_installment
            await AppDataSource.getRepository(tblAccountInstallment).update(
                { accountNo: accountNo, status: '1' },
                { status: '0', deleteDate: new Date(), deleteBy: username }
            );

            // Soft delete from tbl_account_hair_cut
            await AppDataSource.getRepository(tblAccountHairCut).update(
                { accountNo: accountNo, status: '1' },
                { status: '0', deleteDate: new Date(), deleteBy: username }
            );

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
