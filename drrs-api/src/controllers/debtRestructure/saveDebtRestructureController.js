const baseLogger = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const HairCutService = require('../../services/debtRestructure/saveHairCutPlanService');
const InstallmentService = require('../../services/debtRestructure/saveInstallmentPlanService');
const ConditionXMLService = require('../../services/condition/getConditionXMLService');
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');
const { checkIncomeService } = require('../../services/debtRestructure/checkIncomeService');
const logger = baseLogger.child({ context: 'saveDebtRestructureController' });
const tblSettingsStep = require('../../entities/tblSettingsStep');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const { formatThaiMonthYear } = require('../../utils/formatThaiMonthYear');
const { AppDataSource } = require('../../config/database');

const saveDebtRestructureController = async (req, res) => {
    let actionStep = ``;
    try {
        let payloads = Array.isArray(req.body) ? req.body : [req.body];

        if (payloads.length === 0) {
            return sendError(res, 'กรุณาส่งข้อมูลให้ครบถ้วน', 400);
        }

        // =========================================================
        // 🛡️ INCOME VALIDATION GUARD — ตรวจสอบรายได้จาก DB โดยตรงก่อนบันทึก
        // ป้องกัน bypass ไม่ว่าจะมาจาก Frontend หรือ API call ตรงก็ตาม
        // =========================================================
        const cusTargetId = payloads[0]?.cusTargetId;
        if (cusTargetId) {
            const accountsToCheck = payloads.map(p => ({
                accountNo: p.accountNo,
                planNo: p.planNo
            }));

            const incomeCheck = await checkIncomeService(cusTargetId, accountsToCheck);

            if (!incomeCheck.isValid) {
                logger.warn(`[Income Guard] รายได้สุทธิไม่เพียงพอ | netIncome: ${incomeCheck.netIncome} | totalMinAmount: ${incomeCheck.totalMinAmount} | accounts: ${incomeCheck.failedAccounts.join(', ')}`);
                return sendError(res,
                    `รายได้สุทธิไม่เพียงพอชำระหนี้ตามแผนที่เลือก (รายได้สุทธิ: ${incomeCheck.netIncome.toLocaleString()} บาท / ต้องมียอดรายได้สุทธิขั้นต่ำรวม: ${incomeCheck.totalMinAmount.toLocaleString()} บาท)`,
                    400,
                    { netIncome: incomeCheck.netIncome, totalMinAmount: incomeCheck.totalMinAmount }
                );
            }

            logger.info(`[Income Guard] ผ่านการตรวจสอบรายได้ | netIncome: ${incomeCheck.netIncome} >= totalMinAmount: ${incomeCheck.totalMinAmount}`);
        }
        // =========================================================

        let combinedResults = [];
        let combinedTemplateItems = [];
        let lastTemplate = null;

        for (const p of payloads) {
            const {
                accountNo,
                loantype,
                planNo,
                planDetail: {
                    amount = 0,
                    principal = 0,
                    installmentAmount = 0,
                    interest = 0,
                    installmentTerm = 0,
                    installmentFrequency = 0
                } = {}
            } = p;

            if (!accountNo || !loantype || !planNo) {
                return sendError(res, 'กรุณาส่งข้อมูลให้ครบถ้วน', 400);
            }

            let cusTargetId = p.cusTargetId;
            if (!cusTargetId) {
                return sendError(res, 'กรุณาส่ง cusTargetId มาให้ครบถ้วน', 400);
            }

            // =========================================================
            // 🌟 ตรวจสอบเงื่อนไขจาก tbl_settings_step ก่อนทำการบันทึก (Step Check)
            // =========================================================
            const settingStep = await AppDataSource.getRepository(tblSettingsStep).findOne({
                where: { accountNo: accountNo }
            }) || {};

            const stepConfirmPlan = settingStep?.stepConfirmPlan ? String(settingStep.stepConfirmPlan).trim() : '0';
            const stepSendToCbs = settingStep?.stepSendToCbs ? String(settingStep.stepSendToCbs).trim() : '0';

            logger.info(`[Step Check Before Save] Account: ${accountNo} | stepConfirmPlan: ${stepConfirmPlan} | stepSendToCbs: ${stepSendToCbs}`);

            if (stepConfirmPlan === '1' && stepSendToCbs === '1') {
                logger.warn(`Account ${accountNo} ผ่านขั้นตอนการเลือกแผนและสร้างเอกสารครบแล้ว ไม่สามารถบันทึกซ้ำได้`);
                return sendError(res, 'บัญชีนี้ผ่านขั้นตอนการเลือกแผนและสร้างเอกสารเรียบร้อยแล้ว ไม่สามารถบันทึกซ้ำได้', 400, {
                    stepConfirmPlan,
                    stepSendToCbs
                });
            }

            if (stepConfirmPlan === '1' && stepSendToCbs === '0') {
                logger.warn(`Account ${accountNo} มีสัญญาบันทึกไว้แล้ว (select_plan=1, gen_template=0) ส่งข้อมูลเพื่อไปที่หน้า Consent ทันที`);
                const currentStep = (loantype === "LT") ? 'SAVE_INSTALLMENT_PLAN' : 'SAVE_HAIR_CUT_PLAN';
                const { month, year } = formatThaiMonthYear(new Date());
                const template = {
                    filename: `condition_${year || ''}.pdf`,
                    conditionMonth: month,
                    conditionYear: year,
                    items: [
                        { desc: currentStep, accountNo: accountNo }
                    ]
                };

                combinedResults.push({ accountNo, loantype, planNo, status: "skip" });
                if (template && template.items) {
                    combinedTemplateItems.push(...template.items);
                    lastTemplate = template;
                }
                continue;
            }

            if (loantype === "HC") {
                if (amount === 0) {
                    return sendError(res, 'กรุณาระบุยอดเงินสำหรับปิดบัญชี', 400);
                }

                const hairCutPlanPayload = {
                    "cusTargetId": cusTargetId,
                    "accountNo": accountNo,
                    "loantype": loantype,
                    "planNo": planNo,
                    "amount": amount
                };

                const { result, xmlTemplate } = await savePlan(loantype, hairCutPlanPayload);

                logger.info(`[Step Log] อัปเดต step selectPlan: "1" สำหรับ AccountNo: ${accountNo}`);
                await createStepService.updateStepService(accountNo, { stepConfirmPlan: "1" }, 'stepConfirmPlan');

                logger.info(`บันทึก HAIRCUT PLAN สำเร็จ: ${JSON.stringify(result)}`);
                combinedResults.push(result);
                if (xmlTemplate && xmlTemplate.items) {
                    combinedTemplateItems.push(...xmlTemplate.items);
                    lastTemplate = xmlTemplate;
                }

            } else if (loantype === "LT") {
                if (principal === 0 || installmentAmount === 0 || interest === 0 || installmentTerm === 0 || installmentFrequency === 0) {
                    return sendError(res, 'กรุณาระบุข้อมูลให้ครบถ้วน', 400);
                }

                const InstallmentPlanPayload = {
                    "cusTargetId": cusTargetId,
                    "accountNo": accountNo,
                    "loantype": loantype,
                    "planNo": planNo,
                    "principal": principal,
                    "installmentAmount": installmentAmount,
                    "interest": interest,
                    "installmentTerm": installmentTerm,
                    "installmentFrequency": installmentFrequency,
                };

                const { result, xmlTemplate } = await savePlan(loantype, InstallmentPlanPayload);

                logger.info(`[Step Log] อัปเดต step selectPlan: "1" สำหรับ AccountNo: ${accountNo}`);
                await createStepService.updateStepService(accountNo, { stepConfirmPlan: "1" }, 'stepConfirmPlan');

                logger.info(`บันทึก INSTALLMENT PLAN สำเร็จ: ${JSON.stringify(result)}`);
                combinedResults.push(result);
                if (xmlTemplate && xmlTemplate.items) {
                    combinedTemplateItems.push(...xmlTemplate.items);
                    lastTemplate = xmlTemplate;
                }

            } else {
                return sendError(res, 'ข้อมูลประเภทการปรับปรุงโครงสร้างหนี้ไม่ถูกต้อง', 400);
            }
        }

        if (lastTemplate) {
            lastTemplate.items = combinedTemplateItems;
        }

        return sendSuccess(res, 'บันทึกข้อมูลปรับปรุงโครงสร้างหนี้สำเร็จ', combinedResults, lastTemplate);

    } catch (error) {
        let userMessage = 'ไม่สามารถบันทึกข้อมูลลงระบบได้';
        logger.error(`เกิดข้อผิดพลาดในการบันทึกข้อมูล [${error.step}][${error.actionStep}]: ${error.message}`);

        if (error.message && error.message.includes('มีการสร้างรายการแล้ว')) {
            // ดึงข้อความที่คุณ Throw ไว้ (เช่น "บัญชี 1234 มีการสร้างรายการแล้ว...") มาใช้เลย
            userMessage = error.message;

            // 💡 แนะนำ: กรณีข้อมูลซ้ำ มักจะใช้ Status 400 (Bad Request) หรือ 409 (Conflict) แทน 500 ครับ
            return sendError(res, userMessage, 400, error);
        }
        if (actionStep === 'SAVE_HAIR_CUT_PLAN') {
            userMessage = 'ไม่สามารถบันทึกข้อมูลสัญญาได้ กรุณาตรวจสอบข้อมูล';
        } else if (actionStep === 'GET_XML_TEMPLATE') {
            userMessage = 'บันทึกข้อมูลสำเร็จ แต่ไม่สามารถสร้างเอกสาร PDF ได้ (ไม่พบ Template)';
        }
        return sendError(res, 'ไม่สามารถบันทึกข้อมูลลงระบบได้', 500, error);
    }
};


const savePlan = async (loantype, payload) => {
    let currentStep = '';
    try {
        loantype == "LT" ? currentStep = 'SAVE_INSTALLMENT_PLAN' : loantype == "HC" ? currentStep = 'SAVE_HAIR_CUT_PLAN' : '';
        const isDuplicate = await checkDuplicateAccount(loantype, payload.accountNo);

        if (isDuplicate) {
            logger.error(`บัญชี ${payload.accountNo} มีการสร้างรายการแล้ว ไม่สามารถสร้างซ้ำได้`)
            throw new Error(`บัญชี ${payload.accountNo} มีการสร้างรายการแล้ว ไม่สามารถสร้างซ้ำได้`);
        }

        logger.warn(`-=-----------------------------------------`)
        const result = await (loantype === "LT" ? InstallmentService.saveInstallmentPlanService(payload) : HairCutService.saveAccHairCutPlanService(payload));
        logger.warn(`-2=-----------------------------------------`)

        const currentTimestamp = result.data.createdDate;
        const { month, year } = formatThaiMonthYear(currentTimestamp);

        const template = {
            filename: `condition_${year || ''}.pdf`,
            conditionMonth: month,
            conditionYear: year,
            items: [
                { desc: currentStep, accountNo: result.data.accountNo },
            ]
        }
        console.log("Template data:", template);

        return {
            result: result.data,
            xmlTemplate: template
        };

    } catch (error) {
        error.actionStep = currentStep;
        throw error;
    }
};

const checkDuplicateAccount = async (loantype, accountNo) => {
    let step = 'CHECK_DUPLICATE';
    try {
        const entity = (loantype === "LT") ? tblAccountInstallment : tblAccountHairCut;
        const count = await AppDataSource.getRepository(entity).count({
            where: { accountNo: accountNo, status: '1' }
        });

        return count > 0;

    } catch (error) {
        error.actionStep = step;
        throw error;
    }
};

module.exports = {
    saveDebtRestructureController
};