const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const logger = baseLogger.child({ context: 'verifyService' });
const tblSettingsApp = require('../../entities/tblSettingsApp');

/**
 * คำนวณสถานะเปิด/ปิดระบบจริง (status_flag) ตาม schedule_flag:
 *   scheduleFlag = true  -> เปิดเฉพาะช่วง startTime <= now <= endTime (ไม่สนใจ statusFlag เดิม)
 *                           ถ้าไม่มี startTime/endTime ถือว่าปิด (กันตั้ง schedule ไว้แต่ลืมกำหนดช่วงเวลา)
 *   scheduleFlag = false -> ใช้ statusFlag ตรงๆ แบบเดิม (เปิด/ปิดด้วยมือ)
 */
const resolveStatusFlag = (item) => {
    if (!item.scheduleFlag) return item.statusFlag;

    const now = new Date();
    if (!item.startTime || !item.endTime) return false;
    return now >= new Date(item.startTime) && now <= new Date(item.endTime);
};

const checkCloseSystemService = async (channel) => {
    try {
        const result = await AppDataSource.getRepository(tblSettingsApp).find({
            select: { statusFlag: true, appVersion: true, scheduleFlag: true, startTime: true, endTime: true },
            where: { channel: channel, status: '1' }
        });

        const mappedResult = result.map(item => ({
            status_flag: resolveStatusFlag(item),
            appVersion: item.appVersion
        }));

        // logger.info(`result plan: ${JSON.stringify(mappedResult)}`);

        return {
            status: true, 
            message: 'ระบบเปิดใช้งาน',
            data: mappedResult
        };
    } catch (error) {
        logger.error(`error: ${error}`)
        throw error;
    }
};

module.exports = { checkCloseSystemService };