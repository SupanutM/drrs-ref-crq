const { AppDataSource } = require('../config/database');
const tblAccountHairCut = require('../entities/tblAccountHairCut');
const tblAccountInstallment = require('../entities/tblAccountInstallment');
const tblCusTarget = require('../entities/tblCusTarget');
const tblAccountCusTarget = require('../entities/tblAccountCusTarget');
const { inquiryAccountService } = require('../services/register/inquiryAccountService');
const { formatThaiFullDate, formatYYYYMMDD, parseDbDate } = require('./calculateInstallmentSchedule');
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

            // "ชำระภายในวันที่" ของแผน Haircut ใช้ expire_date จาก tbl_account_cus_target ตรงๆ เท่านั้น
            // (ไม่ใช้ ScheduledNextDate จาก CBS อีกต่อไป) — ดึงจาก DB เอง ไม่เชื่อค่าที่ frontend ส่งมา
            // เก็บทั้งข้อความไทย (แสดงบน PDF/หน้าเว็บ) และ YYYYMMDD ดิบ (ยิงไป CBS Register Digitalloan
            // เป็น Plan1ExpireDate — ดู registerDigitalLoanService)
            const planWhere = { accountNo: acc.accountNo, status: '1' };
            if (acc.planNo) planWhere.planNo = acc.planNo;
            const accountTarget = await AppDataSource.getRepository(tblAccountCusTarget).find({
                select: { expireDate: true },
                where: planWhere,
                order: { createdDate: "DESC" },
                take: 1
            });
            const expireDateParsed = (accountTarget && accountTarget.length > 0) ? parseDbDate(accountTarget[0].expireDate) : null;
            acc.expireDate = formatThaiFullDate(expireDateParsed);
            acc.expireDateRaw = formatYYYYMMDD(expireDateParsed);
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
 * ยิง inquiry แยกเป็นรอบตาม SubMethod (spec ใหม่ 2026-09-15) — 1 บัญชีอาจต้องยิงมากกว่า 1 ครั้ง:
 *   SUMALL    (ทั้ง 2 แผน) -> วงเงินกู้/ภาระหนี้คงเหลือ/เงินต้น/ดอกเบี้ย
 *     CreditLimit    -> loanAmount         (วงเงินกู้)
 *     TotalAmount    -> outstandingBalance (ภาระหนี้คงเหลือ)
 *     Balance        -> principal          (เงินต้น)
 *     AccrueInterest -> interest           (ดอกเบี้ย)
 *   NEXTPLN1  (เฉพาะแผนผ่อนชำระ, ต้องมี installmentTerms เสมอ) -> กำหนดชำระงวดถัดไป/วันครบกำหนด
 *     ScheduledNextDate -> scheduledNextDate (ใช้ตรงๆ ไม่คำนวณเพิ่ม)
 *     NewMdt            -> endDateRaw (วันเสร็จสิ้นจริงจาก CBS ใช้ตรงๆ เท่านั้น ห้ามคำนวณจาก
 *                           installmentTerms แทนเด็ดขาด — ดู calculateInstallmentSchedule.js)
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

        let hasData = false;

        // รอบที่ 1: SUMALL — ทุกแผนต้องมี (วงเงิน/ภาระหนี้/เงินต้น/ดอกเบี้ย)
        try {
            const result = await inquiryAccountService({
                accountNo: acc.accountNo,
                subMethod: 'SUMALL',
                source,
                planNo: acc.planNo,
            });

            if (result.success && result.data) {
                const cbs = result.data;
                // CBS บางครั้งตอบ "" (empty string) แทน null จริงๆ เมื่อไม่มีข้อมูลให้บัญชีนั้น
                // (เช่น หาบัญชีไม่เจอฝั่ง CBS) — เช็ค != null เพียวๆ ไม่พอ (เพราะ "" != null เป็น true)
                // ต้องกัน "" ไว้ตั้งแต่ต้นทาง ไม่ให้หลุดเข้า acc แล้วไปพังตอน insert ลง column numeric
                if (cbs.CreditLimit != null && cbs.CreditLimit !== '') { acc.loanAmount = cbs.CreditLimit; hasData = true; }
                if (cbs.TotalAmount != null && cbs.TotalAmount !== '') { acc.outstandingBalance = cbs.TotalAmount; hasData = true; }
                if (cbs.Balance != null && cbs.Balance !== '') { acc.principal = cbs.Balance; hasData = true; }
                if (cbs.AccrueInterest != null && cbs.AccrueInterest !== '') { acc.interest = cbs.AccrueInterest; hasData = true; }
                if (!hasData) {
                    logger.warn(`[CBS Inquiry SUMALL] ไม่พบข้อมูลบัญชี ${acc.accountNo} จาก CBS (ทุก field ว่าง)`);
                }
            } else {
                logger.warn(`[CBS Inquiry SUMALL] ไม่สามารถดึงข้อมูลบัญชี ${acc.accountNo} จาก CBS ได้: ${result.message}`);
            }
        } catch (error) {
            logger.warn(`[CBS Inquiry SUMALL] เกิดข้อผิดพลาดขณะ inquiry บัญชี ${acc.accountNo}: ${error.message}`);
        }

        // รอบที่ 2: NEXTPLN1 — เฉพาะแผนผ่อนชำระ (isHaircut=false) เพื่อดูกำหนดชำระงวดถัดไป
        // installmentTerms ต้องมีค่าเสมอ (มาจาก augmentAccountsWithDbData ก่อนหน้านี้แล้ว) — ถ้าไม่มี
        // ค่า ห้ามยิง CBS เด็ดขาด (spec บังคับ) ให้ตัดบัญชีนี้ออกจากรอบนี้เหมือนกรณี inquiry ไม่พบข้อมูล
        if (!acc.isHaircut) {
            if (acc.installmentTerms === undefined || acc.installmentTerms === null || acc.installmentTerms === '') {
                logger.warn(`[CBS Inquiry NEXTPLN1] บัญชี ${acc.accountNo} ไม่มี installmentTerms — งดยิง CBS (ต้องมีค่าเสมอ)`);
            } else {
                try {
                    const result = await inquiryAccountService({
                        accountNo: acc.accountNo,
                        subMethod: 'NEXTPLN1',
                        installmentTerms: acc.installmentTerms,
                        source,
                        planNo: acc.planNo,
                    });

                    if (result.success && result.data) {
                        const cbs = result.data;
                        // ScheduledNextDate (YYYYMMDD) — ใช้เป็นวันเริ่มต้นคำนวณกำหนดการชำระหนี้ในสัญญา PDF
                        if (cbs.ScheduledNextDate != null && cbs.ScheduledNextDate !== '') {
                            acc.scheduledNextDate = cbs.ScheduledNextDate;
                            hasData = true;
                        } else {
                            logger.warn(`[CBS Inquiry NEXTPLN1] ไม่พบ ScheduledNextDate ของบัญชี ${acc.accountNo} จาก CBS`);
                        }
                        // NewMdt (YYYYMMDD) — วันเสร็จสิ้นจริงจาก CBS ใช้ตรงๆ แทนการคำนวณจาก
                        // installmentTerms (ตัดสินใจ 2026-09-15) — ถ้าไม่มีค่า calculateInstallmentSchedule
                        // จะ fallback ไปคำนวณจาก installmentTerms แทนเอง
                        if (cbs.NewMdt != null && cbs.NewMdt !== '') {
                            acc.endDateRaw = cbs.NewMdt;
                        } else {
                            logger.warn(`[CBS Inquiry NEXTPLN1] ไม่พบ NewMdt ของบัญชี ${acc.accountNo} จาก CBS`);
                        }
                    } else {
                        logger.warn(`[CBS Inquiry NEXTPLN1] ไม่สามารถดึงข้อมูลบัญชี ${acc.accountNo} จาก CBS ได้: ${result.message}`);
                    }
                } catch (error) {
                    logger.warn(`[CBS Inquiry NEXTPLN1] เกิดข้อผิดพลาดขณะ inquiry บัญชี ${acc.accountNo}: ${error.message}`);
                }
            }
        }

        // hasData ใช้เช็คว่า inquiry รอบใดรอบหนึ่งเจอข้อมูลบัญชีนี้จริงไหม — ถ้าทุกรอบว่างหมด (CBS หา
        // บัญชีไม่เจอ) ให้ตั้ง cbsInquiryFailed = true เพื่อให้ผู้เรียก (controller) กันบัญชีนี้ออกจาก
        // การลงทะเบียน CBS ตั้งแต่ก่อนยิง Register (ไม่ต้องรอไป error ตอน insert DB)
        acc.cbsInquiryFailed = !hasData;
    }
    return accounts;
};

module.exports = {
    augmentAccountsWithDbData,
    augmentCustomerInfoWithDbData,
    augmentAccountsWithCbsData
};
