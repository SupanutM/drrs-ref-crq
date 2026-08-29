const { AppDataSource } = require('../../config/database');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'checkPlanService' });
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const tblMtMasterPlanDetail = require('../../entities/tblMtMasterPlanDetail');

const checkPlanService = async (planNo) => {
    try {
        // logger.info(`กำลังตรวจสอบสิทธิ์สำหรับแผนหมายเลข: ${planNo}`);

        const result = await AppDataSource.getRepository(tblMtMasterPlan)
            .createQueryBuilder('tmmp')
            .select('tmmp.code', 'planCode')
            .addSelect('tmmp.desc', 'planName')
            .addSelect('tmmpd.desc', 'planDetail')
            .innerJoin(tblMtMasterPlanDetail, 'tmmpd', 'tmmp.code = tmmpd.plan_code AND tmmp.status = tmmpd.status')
            .where('tmmp.code LIKE :planNo', { planNo: planNo })
            .getRawMany();

        // logger.info(`result plan: ${JSON.stringify(result)}`);

        return {
            status: true, 
            message: 'ตรวจสอบสิทธิ์ผ่าน สามารถใช้แผนนี้ได้',
            data: result
        };

    } catch (error) {
        logger.error(`เกิดข้อผิดพลาดในการตรวจสอบแผน: ${error.message}`);
        throw error;
    }
};

module.exports = { checkPlanService };