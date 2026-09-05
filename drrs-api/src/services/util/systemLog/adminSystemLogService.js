const { AppDataSource } = require('../../../config/database');
const tblAdminSystemLog = require('../../../entities/tblAdminSystemLog');
const baseLogger = require('../../../utils/logger');
const logger = baseLogger.child({ context: 'adminSystemLogService' });

/**
 * บันทึกประวัติ action ของฝั่ง admin ลงใน tbl_admin_system_log (แยกจาก tbl_system_log ของลูกค้า)
 * โครง/พารามิเตอร์เหมือน systemLogService ทุกอย่าง (ดู services/util/systemLog/systemLogService.js)
 * ต่างกันแค่ปลายทางตาราง — ใช้กับทุก controller ภายใต้ controllers/admin/ เท่านั้น
 * @param {Object} logData - ข้อมูลสำหรับการบันทึก log
 * @param {string} logData.step - ขั้นตอนหรือ action ที่ทำ (เช่น 'adminLogin', 'importMasterData')
 * @param {string} logData.controller - ชื่อ controller ที่ทำงาน
 * @param {Object|string} logData.payload - ข้อมูลที่ส่งเข้ามา
 * @param {string|number} logData.responseStatus - สถานะผลลัพธ์ (เช่น 'SUCCESS', 'FAILED')
 * @param {Object|string} logData.response - ข้อมูลที่ตอบกลับหรือข้อความ error
 * @param {string} [logData.createdBy='DRRS'] - ผู้ทำรายการ
 */
const adminSystemLogService = async (logData = {}) => {
    try {
        const { step = '', controller = '', payload = '', responseStatus = '', response = '', createdBy = 'DRRS' } = logData;

        const logRepo = AppDataSource.getRepository(tblAdminSystemLog);

        const formatString = (data) => {
            if (data === null || data === undefined) return '';
            if (typeof data === 'object') {
                try {
                    return JSON.stringify(data);
                } catch (error) {
                    return String(data);
                }
            }
            return String(data);
        };

        const newLog = logRepo.create({
            step: String(step),
            controller: String(controller),
            payload: formatString(payload),
            responseStatus: String(responseStatus),
            response: formatString(response),
            createdDate: new Date(),
            createdBy: createdBy
        });

        const savedLog = await logRepo.save(newLog);

        return {
            success: true,
            message: 'บันทึก Admin System Log สำเร็จ',
            data: savedLog
        };
    } catch (error) {
        logger.error(`Error in adminSystemLogService: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    adminSystemLogService
};
