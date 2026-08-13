const { AppDataSource } = require('../../../config/database');
const tblSettingsStep = require('../../../entities/tblSettingsStep');
const baseLogger = require('../../../utils/logger');
const logger = baseLogger.child({ context: 'createStepService' });

/**
 * สร้าง record ครั้งแรกหรืออัปเดต step ในตาราง tbl_settings_step
 * @param {string} accountNo - เลขที่บัญชีลูกค้า (จาก targetResult.data.accountNo)
 * @param {object} stepData - ออบเจกต์ของ flag ที่ต้องการอัปเดต เช่น { verifyTarget: "1" } หรือ { verifyLaserId: "1" }
 * @param {string} updatedBy - ชื่อระบบหรือผู้ที่ทำการอัปเดต (เช่น 'verify-register')
 */
const createStepService = async (accountNo, stepData = { stepVerifyTarget: "1" }, updatedBy = 'system') => {
    try {
        if (!accountNo) {
            logger.warn('ไม่พบ accountNo สำหรับสร้างหรืออัปเดตใน tbl_settings_step');
            return {
                success: false,
                message: 'ไม่พบเลขที่บัญชี (accountNo)'
            };
        }

        const stepRepo = AppDataSource.getRepository(tblSettingsStep);
        const existingRecord = await stepRepo.findOne({
            where: { accountNo: accountNo }
        });

        if (!existingRecord) {
            logger.info(`[Step Log] ไม่พบข้อมูลเดิม ทำการสร้าง record ใหม่ใน tbl_settings_step สำหรับ Account: ${accountNo}`);
            const newStep = stepRepo.create({
                accountNo: accountNo,
                stepVerifyTarget: "1",
                stepVerifyLaser: "0",
                stepViewPlan: "0",
                stepConfirmPlan: "0",
                stepSendToCbs: "0",
                stepSendMail: "",
                ...stepData,
                createdDate: new Date(),
                createdBy: updatedBy
            });
            const savedResult = await stepRepo.save(newStep);
            logger.info(`[Step Log] สร้าง record ใหม่สำเร็จ: ${JSON.stringify(savedResult)}`);
            return {
                success: true,
                message: 'สร้าง record ใหม่ใน tbl_settings_step สำเร็จ',
                data: savedResult
            };
        } else {
            logger.info(`[Step Log] พบ record เดิมของ Account: ${accountNo} ทำการอัปเดต flag ใน tbl_settings_step`);
            const updatePayload = {
                ...stepData,
                updateBy: updatedBy
            };
            const updateResult = await stepRepo.update({ accountNo: accountNo }, updatePayload);
            logger.info(`[Step Log] อัปเดต step สำเร็จ: ${JSON.stringify(updatePayload)}`);
            return {
                success: true,
                message: 'อัปเดต record ใน tbl_settings_step สำเร็จ',
                data: updatePayload
            };
        }
    } catch (error) {
        logger.error(`Error in createStepService: ${error.message}`);
        throw error;
    }
};

/**
 * อัปเดตสถานะ step ในตาราง tbl_settings_step (หากไม่มี record จะทำการสร้างให้ใหม่อัตโนมัติ)
 */
const updateStepService = async (accountNo, stepData = {}, updatedBy = 'system') => {
    try {
        if (!accountNo) {
            logger.warn('ไม่พบ accountNo สำหรับอัปเดต tbl_settings_step');
            return {
                success: false,
                message: 'ไม่พบเลขที่บัญชี (accountNo)'
            };
        }

        const stepRepo = AppDataSource.getRepository(tblSettingsStep);
        const existingRecord = await stepRepo.findOne({
            where: { accountNo: accountNo }
        });

        if (!existingRecord) {
            return await createStepService(accountNo, stepData, updatedBy);
        }

        logger.info(`[Step Log] อัปเดต step สำหรับ Account: ${accountNo} -> ${JSON.stringify(stepData)}`);
        const updatePayload = {
            ...stepData,
            updateBy: updatedBy
        };
        const updateResult = await stepRepo.update({ accountNo: accountNo }, updatePayload);

        return {
            success: true,
            message: 'อัปเดต step ใน tbl_settings_step สำเร็จ',
            data: updateResult
        };
    } catch (error) {
        logger.error(`Error in updateStepService: ${error.message}`);
        throw error;
    }
};

module.exports = {
    createStepService,
    updateStepService
};
