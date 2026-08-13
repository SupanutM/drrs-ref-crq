const { In } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const tblMtMasterPlanDetail = require('../../entities/tblMtMasterPlanDetail');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const createStepService = require('../util/systemLog/createStepService');
const { systemLogService } = require('../util/systemLog/systemLogService');
const logger = baseLogger.child({ context: 'verifyService' });

const masterPlanService = async (planNos = [], accountNo = null) => {
    try {
        const tblMtMasterPlanRepo = AppDataSource.getRepository(tblMtMasterPlan);
        
        // Find plans by planNos array
        let rawMasterPlans = [];
        if (planNos && planNos.length > 0) {
            rawMasterPlans = await tblMtMasterPlanRepo.find({
                where: {
                    code: In(planNos),
                    status: "1"
                }
            });
        }

        // Map to the format the frontend expects (previously matched tblCusTargetPlan)
        const masterPlan = rawMasterPlans.map(plan => ({
            planNo: plan.code,
            planName: plan.desc,
            planDesc: plan.desc,
            status: plan.status,
            isCheckIncome: plan.isCheckIncome,
            accountNo: accountNo // Keep for reference if needed
        }));

        logger.info(`planNo:   ;;;; ${JSON.stringify(masterPlan)}`)
        const tblMtMasterPlanDetailRepo = AppDataSource.getRepository(tblMtMasterPlanDetail);
        
        let masterPlanDetail = [];
        if (planNos.length > 0) {
            masterPlanDetail = await tblMtMasterPlanDetailRepo.find({
                where: {
                    planCode: In(planNos),
                    status: "1"
                }
            });
        }

        masterPlan.forEach(plan => {
            plan.details = masterPlanDetail.filter(d => d.planCode === plan.planNo);
        });

        logger.warn(`masterPlanDetail: ${JSON.stringify(masterPlanDetail)}`)
        logger.info(`ดึงข้อมูล Account: ${accountNo} สำเร็จ (พบ ${masterPlan.length} รายการ)`);

        if (accountNo) {
            logger.info(`[Step Log] อัปเดต step stepViewPlan: "1" สำหรับ AccountNo: ${accountNo}`);
            await createStepService.updateStepService(accountNo, { stepViewPlan: "1" }, 'stepViewPlan');

            await systemLogService({
                step: 'gen-plan',
                controller: 'masterPlanService',
                payload: { accountNo, planNos },
                responseStatus: 200,
                response: { message: 'ดึงข้อมูลสำเร็จ', count: masterPlan.length, masterPlan, masterPlanDetail },
                createdBy: 'system'
            });
        }

        return {
            success: true,
            message: 'ดึงข้อมูลสำเร็จ',
            data: {
                masterPlan,
                masterPlanDetail
            }
        };

    } catch (error) {
        logger.error(`Error checking verify code: ${error.message}`);
        await systemLogService({
            step: 'gen-plan',
            controller: 'masterPlanService',
            payload: { accountNo, planNos },
            responseStatus: 500,
            response: error.message,
            createdBy: 'system'
        });
        throw error;
    }
};

module.exports = { masterPlanService };