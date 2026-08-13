const { AppDataSource } = require('../../config/database');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'checkPlanService' });
const { loadSqlQuery } = require('../../utils/sqlProvider');



const checkPlanService = async (planNo) => {
    try {
        logger.info(`กำลังตรวจสอบสิทธิ์สำหรับแผนหมายเลข: ${planNo}`);

        // ---------------------------------------------------------
        // 🛠️ โค้ดสำหรับต่อ Database (Uncomment และปรับแก้ Entity ได้เลย)
        // ---------------------------------------------------------
        // const planRepo = AppDataSource.getRepository(tblPlanMaster);
        // const planData = await planRepo.findOne({ 
        //     where: { planNo: planNo, isActive: 'Y' } 
        // });
        //
        // if (!planData) {
        //     return { 
        //         status: false, 
        //         message: 'ไม่พบข้อมูลแผนนี้ หรือแผนนี้ถูกปิดการใช้งานไปแล้ว' 
        //     };
        // }
        // ---------------------------------------------------------
        const sqlName = 'check_plan_detail.sql';
        logger.info(`sql: ${sqlName}`)

        const sql = loadSqlQuery(sqlName);
        logger.info(`sql: ${sql}`)
        const result = await AppDataSource.query(sql, [planNo]);

        logger.info(`result plan: ${result}`)

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