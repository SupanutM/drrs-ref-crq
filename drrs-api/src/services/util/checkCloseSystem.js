const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const masterPlan = require('../../services/plan/masterPlanService');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const logger = baseLogger.child({ context: 'verifyService' });
const tblSettingsApp = require('../../entities/tblSettingsApp');

const checkCloseSystemService = async (channel) => {
    try {
        const result = await AppDataSource.getRepository(tblSettingsApp).find({
            select: { statusFlag: true, appVersion: true },
            where: { channel: channel, status: '1' }
        });

        const mappedResult = result.map(item => ({
            status_flag: item.statusFlag,
            appVersion: item.appVersion
        }));

        logger.info(`result plan: ${JSON.stringify(mappedResult)}`);

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