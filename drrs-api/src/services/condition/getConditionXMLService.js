const { AppDataSource } = require('../../config/database');
const tblTemplateCondition = require('../../entities/tblTemplateCondition');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'getTemplateXML' });
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
const tblCusTarget = require('../../entities/tblCusTarget');

const getConditionXMLService = async (loanType, accountNo) => {
    
    try {
        const entity = loanType === "HC" ? tblAccountHairCut : tblAccountInstallment;
        const result = await AppDataSource.getRepository(entity)
            .createQueryBuilder('ta')
            .select('tct.account_no', 'accountNo')
            .addSelect("concat(tct.first_name , ' ', tct.last_name)", 'fullName')
            .addSelect('ta.plan_no', 'planNo')
            .addSelect('CAST(ta.created_date AS DATE)', 'regisDate')
            .innerJoin(tblCusTarget, 'tct', "ta.account_no = tct.account_no AND tct.status = '1'")
            .where('ta.account_no LIKE :accountNo', { accountNo: accountNo })
            .andWhere("ta.status LIKE '1'")
            .getRawMany();

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