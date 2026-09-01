const { In } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const createStepService = require('../util/systemLog/createStepService');
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
            loanType: plan.loanType,
            accountNo: accountNo // Keep for reference if needed
        }));

        if (accountNo) {
            // อัปเดต flag stepViewPlan ราย account (ต่อบัญชี — ถูกต้อง)
            // ส่วน audit PLAN_PREVIEW ย้ายไปเขียนครั้งเดียวที่ verifyCusTargetService
            // (กันเขียนซ้ำ 1 log ต่อบัญชี — เดิมลูกค้า 4 บัญชี = 4 log)
            await createStepService.updateStepService(accountNo, { stepViewPlan: "1" }, 'stepViewPlan');
        }

        return {
            success: true,
            message: 'ดึงข้อมูลสำเร็จ',
            data: {
                masterPlan
            }
        };

    } catch (error) {
        logger.error(`Error fetching master plan (account ${accountNo}): ${error.message}`);
        throw error;
    }
};

module.exports = { masterPlanService };