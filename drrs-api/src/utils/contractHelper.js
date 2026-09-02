const { AppDataSource } = require('../config/database');
const tblAccountHairCut = require('../entities/tblAccountHairCut');
const tblAccountInstallment = require('../entities/tblAccountInstallment');
const tblCusTarget = require('../entities/tblCusTarget');
const tblAccountCusTarget = require('../entities/tblAccountCusTarget');
const { inquiryAccountService } = require('../services/register/inquiryAccountService');
const { formatThaiFullDate } = require('./calculateInstallmentSchedule');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'contractHelper' });

const augmentAccountsWithDbData = async (accounts) => {
    for (let acc of accounts) {
        if (acc.isHaircut) {
            const resDb = await AppDataSource.getRepository(tblAccountHairCut).find({
                select: { amount: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].amount;
            }
        } else {
            const resDb = await AppDataSource.getRepository(tblAccountInstallment).find({
                select: { installmentAmount: true, installmentTerm: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].installmentAmount;
                acc.installmentTerms = resDb[0].installmentTerm;

                // If there is only one default installment in the array, update it too
                if (acc.installments && acc.installments.length === 1) {
                    acc.installments[0].amount = resDb[0].installment_amount;
                }
            }
        }
    }
    return accounts;
};

const augmentCustomerInfoWithDbData = async (cusTargetId, accountNo) => {
    let finalCusTargetId = cusTargetId;

    if (!finalCusTargetId && accountNo) {
        // Try to find cusTargetId from tblAccountCusTarget
        const accountCusTarget = await AppDataSource.getRepository(tblAccountCusTarget).findOne({
            where: { accountNo: accountNo }
        });
        if (accountCusTarget) {
            finalCusTargetId = accountCusTarget.cusTargetId;
        }
    }

    if (!finalCusTargetId) {
        logger.warn(`augmentCustomerInfoWithDbData: Missing both cusTargetId and accountNo. Cannot fetch customer details.`);
        return {};
    }

    const cusTarget = await AppDataSource.getRepository(tblCusTarget).findOne({
        where: { id: finalCusTargetId }
    });

    if (!cusTarget) {
        logger.warn(`augmentCustomerInfoWithDbData: Customer target not found for id ${finalCusTargetId}`);
        return {};
    }

    return {
        cusTargetId: cusTarget.id,
        firstName: cusTarget.firstName,
        lastName: cusTarget.lastName,
        citizenId: cusTarget.citizenId,
        cifNo: cusTarget.cifNo,
        address: cusTarget.address,
        email: cusTarget.email,
        mobileNo: cusTarget.telNo, // Contract templates might use mobileNo
        telNo: cusTarget.telNo,
        birthday: cusTarget.birthday
    };
};

/**
 * เติมข้อมูลบัญชีด้วยผลลัพธ์ Inquiry จาก CBS (ตอนยอมรับสัญญา ก่อนสร้าง PDF)
 * Map field จาก CBS (PascalCase) -> field ที่ template/PDF ใช้อยู่แล้ว:
 *   CreditLimit      -> loanAmount         (วงเงินกู้)
 *   TotalAmount      -> outstandingBalance (ภาระหนี้คงเหลือ)
 *   Balance          -> principal          (เงินต้น)
 *   AccrueInterest   -> interest           (ดอกเบี้ย)
 * นอกจากนี้ contractDate (วันทำสัญญา) ใช้วันที่ปัจจุบัน (now) เสมอ — ไม่ใช่ค่าจาก CBS
 * ไม่ throw ถ้า CBS ล้มเหลว — ปล่อยให้ flow สร้างสัญญาไปต่อด้วยข้อมูลที่มีอยู่แล้ว (จาก DB/frontend)
 *
 * @param {Array} accounts
 * @param {string} [source] - แหล่งที่มาของการเรียก เช่น "preview" — ถ้ามาจาก preview (ยังไม่กดยอมรับ)
 *   จะไม่บันทึกผลลัพธ์ลง tbl_cbs_inquiry_account (ส่งต่อให้ inquiryAccountService เหมือนกับ
 *   source: "select-plan" ที่ใช้ตอนหน้า select-plan) — กันบันทึกซ้ำเวลาลูกค้าดู preview ก่อนกดยอมรับ
 */
const augmentAccountsWithCbsData = async (accounts, source) => {
    const contractDate = formatThaiFullDate(new Date());

    for (const acc of accounts) {
        // วันทำสัญญา = วันที่กดยอมรับ (now) เสมอ ไม่ว่า CBS จะสำเร็จหรือไม่
        acc.contractDate = contractDate;

        try {
            const result = await inquiryAccountService({ accountNo: acc.accountNo, source, planNo: acc.planNo });

            if (result.success && result.data) {
                const cbs = result.data;
                if (cbs.CreditLimit != null) acc.loanAmount = cbs.CreditLimit;
                if (cbs.TotalAmount != null) acc.outstandingBalance = cbs.TotalAmount;
                if (cbs.Balance != null) acc.principal = cbs.Balance;
                if (cbs.AccrueInterest != null) acc.interest = cbs.AccrueInterest;
                // ScheduledNextDate (YYYYMMDD) — ใช้เป็นวันเริ่มต้นคำนวณกำหนดการชำระหนี้ในสัญญา PDF
                if (cbs.ScheduledNextDate != null) acc.scheduledNextDate = cbs.ScheduledNextDate;
            } else {
                logger.warn(`[CBS Inquiry] ไม่สามารถดึงข้อมูลบัญชี ${acc.accountNo} จาก CBS ได้: ${result.message}`);
            }
        } catch (error) {
            logger.warn(`[CBS Inquiry] เกิดข้อผิดพลาดขณะ inquiry บัญชี ${acc.accountNo}: ${error.message}`);
        }
    }
    return accounts;
};

module.exports = {
    augmentAccountsWithDbData,
    augmentCustomerInfoWithDbData,
    augmentAccountsWithCbsData
};
