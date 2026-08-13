const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const masterPlan = require('../../services/plan/masterPlanService');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const logger = baseLogger.child({ context: 'verifyService' });
const { loadSqlQuery } = require('../../utils/sqlProvider');

const checkCloseSystemService = async (channel) => {
    try {
        const sqlName = 'check_close_system.sql';
        logger.info(`sql: ${sqlName}`)

        const sql = loadSqlQuery(sqlName);
        logger.info(`sql: ${sql}`)
        const result = await AppDataSource.query(sql, [channel]);

        logger.info(`result plan: ${result}`)

        return {
            status: true, 
            message: 'ระบบเปิดใช้งาน',
            data: result
        };
    } catch (error) {
        logger.error(`error: ${error}`)
        throw error;
    }
};

module.exports = { checkCloseSystemService };