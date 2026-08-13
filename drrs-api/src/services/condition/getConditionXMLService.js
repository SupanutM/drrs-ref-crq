const { AppDataSource } = require('../../config/database');
const tblTemplateCondition = require('../../entities/tblTemplateCondition');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'getTemplateXML' });
const { loadSqlQuery } = require('../../utils/sqlProvider');

const getConditionXMLService = async (loanType, accountNo) => {
    let sql = ``;

    loanType == "HC" ? sql = loadSqlQuery('get_data_template_hair_cut.sql') : sql = loadSqlQuery('get_data_template_installment.sql');
    
    try {
        const result = await AppDataSource.query(sql, [accountNo]);

        logger.info(`result: ${JSON.stringify(result)}`);

        if (result && result.length > 0) {
            const acc = result[0];
            logger.info(`พบข้อมูล: ${JSON.stringify(acc)}`);
            return acc;
        } else {
            logger.info(`template data: ${acc}`);
            return null;
        }
    } catch (error) {
        logger.error(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}`);
        throw error;
    }
};

module.exports = {
    getConditionXMLService
};