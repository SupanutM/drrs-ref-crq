const updateCusTargetService = require('../../services/verify/updateCusTargetSerivce');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'updateIncomeController' });
const { systemLogService } = require('../../services/util/systemLog/systemLogService');

const updateIncomeController = async (req, res) => {
    try {
        const { totalIncome, otherIncome, totalCost, netIncome } = req.body;
        // cusTargetId มาจาก session token (req.auth) ไม่เชื่อค่าจาก body (กัน IDOR)
        const cusTargetId = req.auth?.cusTargetId;

        if (!cusTargetId) {
            logger.warn('ไม่พบ cusTargetId ใน session token');
            return sendError(res, 'unauthorized', 401);
        }

        if (totalIncome === undefined || totalCost === undefined) {
            logger.warn('ข้อมูลรายได้และค่าใช้จ่ายไม่ครบถ้วน');
            return sendError(res, 'กรุณาส่ง totalIncome และ totalCost', 400);
        }

        logger.info(`[Update Income] cusTargetId: ${cusTargetId} | totalIncome: ${totalIncome} | otherIncome: ${otherIncome} | totalCost: ${totalCost} | netIncome: ${netIncome}`);
        
        await updateCusTargetService.updateCusTargetService(cusTargetId, { totalIncome, otherIncome, totalCost, netIncome });

        await systemLogService({
            step: 'update-income',
            controller: 'updateIncomeController',
            payload: { cusTargetId, totalIncome, otherIncome, totalCost, netIncome },
            responseStatus: 200,
            response: { message: 'บันทึกข้อมูลรายได้สำเร็จ', cusTargetId, totalIncome, otherIncome, totalCost, netIncome },
            createdBy: 'system'
        });

        return sendSuccess(res, 'บันทึกข้อมูลรายได้สำเร็จ', { cusTargetId, totalIncome, otherIncome, totalCost, netIncome });

    } catch (error) {
        logger.error(`System Error in updateIncomeController: ${error.message}`);
        
        await systemLogService({
            step: 'update-income',
            controller: 'updateIncomeController',
            payload: req.body,
            responseStatus: 500,
            response: { message: 'เกิดข้อผิดพลาดในการประมวลผล', error: error.message },
            createdBy: 'system'
        }).catch(err => logger.error(`Error saving system log: ${err.message}`));

        return sendError(res, 'เกิดข้อผิดพลาดในการประมวลผล', 500, error);
    }
};

module.exports = {
    updateIncomeController
};
