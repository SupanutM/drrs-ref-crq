const { AppDataSource } = require('../../config/database');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'saveInstallmentPlan' });
const { payloadFormat } = require('../../utils/payloadFormatUtils');

const saveInstallmentPlanService = async (targetPlan) => {
    try {
        const InstallmentRepo = AppDataSource.getRepository(tblAccountInstallment);

        const payload = payloadFormat(targetPlan);
        const newRecord = InstallmentRepo.create(payload);

        // logger.info(`newRecord tbl_account_installment: ${JSON.stringify(newRecord)}`);
        const savedAcc = await InstallmentRepo.save(newRecord);
        // logger.info(`บันทึก tbl_account_installment สำเร็จเรียบร้อย`);

        return { success: true, data: savedAcc };
    } catch (error) {
        logger.error(`Error saving tbl_account_installment: ${error.message}`);
        throw error;
    }
};

module.exports = {
    saveInstallmentPlanService
};