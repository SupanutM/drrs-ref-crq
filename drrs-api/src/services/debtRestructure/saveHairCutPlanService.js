const { AppDataSource } = require('../../config/database');
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'saveAccHairCutPlan' });
const { payloadFormat } = require('../../utils/payloadFormatUtils');


const saveAccHairCutPlanService = async (targetPlan) => {
    try {
        logger.info(`--------------------------- 0 --------------------------------`);

        const AccHairCutRepo = AppDataSource.getRepository(tblAccountHairCut);
        logger.info(`--------------------------- 1 --------------------------------`);

        const payload = payloadFormat(targetPlan);
        logger.info(`--------------------------- 2 --------------------------------`);

        const newRecord = AccHairCutRepo.create(payload);

        logger.info(`newRecord tbl_account_hair_cut: ${JSON.stringify(newRecord)}`);
        const savedAcc = await AccHairCutRepo.save(newRecord);
        logger.info(`บันทึก tbl_account_hair_cut สำเร็จเรียบร้อย`);

        return { success: true, data: savedAcc };
    } catch (error) {
        logger.error(`Error saving tbl_account_hair_cut: ${error.message}`);
        throw error;
    }
};

module.exports = {
    saveAccHairCutPlanService
};