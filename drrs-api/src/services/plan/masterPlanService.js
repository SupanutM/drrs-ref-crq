const { In } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const tblContractFileAccount = require('../../entities/tblContractFileAccount');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const createStepService = require('../util/systemLog/createStepService');
const logger = baseLogger.child({ context: 'verifyService' });

/**
 * ดึง scheduledNextDate/newMaturityDate ล่าสุดของบัญชีนี้ จากสัญญาที่เคยเซ็นไปแล้ว
 * (tbl_contract_file_account snapshot ตอนเซ็น) — ใช้กับบัญชีที่ isRegistered = true เท่านั้น
 * เพื่อโชว์กำหนดชำระของแผนผ่อนชำระจาก DB โดยไม่ต้องยิง CBS ซ้ำ (ไม่มีประโยชน์ เพราะเลือกแผนไม่ได้แล้ว)
 * คืน { scheduledNextDate: null, newMaturityDate: null } ถ้าไม่พบ (สัญญาเก่าก่อนเพิ่ม column นี้)
 */
const getLastContractSchedule = async (accountNo) => {
    try {
        const row = await AppDataSource.getRepository(tblContractFileAccount).findOne({
            select: { scheduledNextDate: true, newMaturityDate: true },
            where: { accountNo },
            order: { createdDate: "DESC" }
        });
        return {
            scheduledNextDate: row?.scheduledNextDate || null,
            newMaturityDate: row?.newMaturityDate || null
        };
    } catch (err) {
        logger.warn(`Error fetching last contract schedule for account ${accountNo}: ${err.message}`);
        return { scheduledNextDate: null, newMaturityDate: null };
    }
};

const masterPlanService = async (planNos = [], accountNo = null, accPlans = []) => {
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

        // เตรียม lookup ยอดเงิน/งวด รายแผน จาก tbl_account_cus_target (ผูกกับบัญชีนี้จริง)
        const accPlanByPlanNo = {};
        (accPlans || []).forEach((accPlan) => {
            if (accPlan?.planNo) accPlanByPlanNo[accPlan.planNo] = accPlan;
        });

        // บัญชีที่ลงทะเบียนไปแล้ว (isRegistered) หน้า select-plan ไม่ยิง CBS Inquiry ซ้ำอีก (ดู
        // SelectPlanController.js) — ดึงวันกำหนดชำระ (แผนผ่อนชำระ) จากสัญญาที่เคยเซ็นไว้ล่าสุดแทน
        // ไม่มีประโยชน์ที่จะดึงถ้าบัญชียังไม่เคยเซ็นสัญญา (จะได้ null ทั้งคู่ ไม่กระทบอะไร)
        const lastSchedule = accountNo ? await getLastContractSchedule(accountNo) : { scheduledNextDate: null, newMaturityDate: null };

        // Map to the format the frontend expects (previously matched tblCusTargetPlan)
        const masterPlan = rawMasterPlans.map(plan => {
            const accPlan = accPlanByPlanNo[plan.code];
            return {
                planNo: plan.code,
                planName: plan.descEn,
                planDesc: plan.descEn,
                status: plan.status,
                isCheckIncome: plan.isCheckIncome,
                loanType: plan.loanType,
                accountNo: accountNo, // Keep for reference if needed
                details: accPlan ? [{
                    paymentAmount: Number(accPlan.paymentAmount || 0),
                    installmentTerms: Number(accPlan.installmentTerms || 0),
                    startDate: accPlan.startDate,
                    expireDate: accPlan.expireDate,
                    // เฉพาะแผนผ่อนชำระ (loanType ไม่ใช่ "HC") — snapshot จากสัญญาที่เคยเซ็นล่าสุด
                    scheduledNextDate: plan.loanType !== "HC" ? lastSchedule.scheduledNextDate : null,
                    newMaturityDate: plan.loanType !== "HC" ? lastSchedule.newMaturityDate : null
                }] : []
            };
        });

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
