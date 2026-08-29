const { AppDataSource } = require('../../config/database');
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'saveAccHairCutPlan' });
const { payloadFormat } = require('../../utils/payloadFormatUtils');


const saveAccHairCutPlanService = async (targetPlan) => {
    try {
        // debug log ที่ไม่จำเป็น + JSON record มีข้อมูลสินเชื่อ — ปิดไว้ (ลด Disk IO / กัน PII)
        const AccHairCutRepo = AppDataSource.getRepository(tblAccountHairCut);
        const payload = payloadFormat(targetPlan);
        const newRecord = AccHairCutRepo.create(payload);
        // logger.info(`newRecord tbl_account_hair_cut: ${JSON.stringify(newRecord)}`);
        const savedAcc = await AccHairCutRepo.save(newRecord);
        // logger.info(`บันทึก tbl_account_hair_cut สำเร็จเรียบร้อย`);

        return { success: true, data: savedAcc };
    } catch (error) {
        logger.error(`Error saving tbl_account_hair_cut: ${error.message}`);
        throw error;
    }
};

module.exports = {
    saveAccHairCutPlanService
};