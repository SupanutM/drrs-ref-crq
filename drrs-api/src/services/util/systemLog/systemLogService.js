const { AppDataSource } = require('../../../config/database');
const tblSystemLog = require('../../../entities/tblSystemLog');
const baseLogger = require('../../../utils/logger');
const logger = baseLogger.child({ context: 'systemLogService' });

/**
 * บันทึกประวัติทุกการ action ของระบบลงในตาราง tbl_system_log
 * @param {Object} logData - ข้อมูลสำหรับการบันทึก log
 * @param {string} logData.step - ขั้นตอนหรือ action ที่ทำ (เช่น 'stepVerifyTarget', 'stepVerifyLaser', 'checkPlan', 'generatePdf')
 * @param {string} logData.controller - ชื่อ controller หรือ service ที่ทำงาน (เช่น 'verifyController', 'checkPlanController')
 * @param {Object|string} logData.payload - ข้อมูลที่ส่งเข้ามา (Request Body / Query / Param)
 * @param {string|number} logData.responseStatus - สถานะผลลัพธ์ (เช่น '200', '400', 'SUCCESS', 'FAILED')
 * @param {Object|string} logData.response - ข้อมูลที่ตอบกลับหรือข้อความ error
 * @param {string} [logData.createdBy='system'] - ผู้ทำรายการ
 */
const systemLogService = async (logData = {}) => {
    try {
        const { step = '', controller = '', payload = '', responseStatus = '', response = '', createdBy = 'system' } = logData;

        const logRepo = AppDataSource.getRepository(tblSystemLog);

        // ฟังก์ชันช่วยแปลงข้อมูล Object หรือ Array ให้เป็น JSON String (หากส่งมาเป็น String อยู่แล้วก็ใช้ต่อได้ทันที)
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
        logger.info(`[System Log] บันทึก Log สำเร็จ (ID: ${savedLog.id}) | Step: ${step} | Controller: ${controller} | Status: ${responseStatus}`);

        return {
            success: true,
            message: 'บันทึก System Log สำเร็จ',
            data: savedLog
        };
    } catch (error) {
        logger.error(`Error in systemLogService: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    systemLogService
};
