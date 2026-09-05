const { AppDataSource } = require('../../config/database');
const tblContractFile = require('../../entities/tblContractFile');
const tblContractFileAccount = require('../../entities/tblContractFileAccount');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'saveContractFileService' });

/**
 * แปลงค่าให้ปลอดภัยสำหรับ column type numeric — กัน empty string ("") ที่ CBS บางครั้งส่งมา
 * แทน null/undefined จริงๆ (เจอจาก CreditLimit/TotalAmount/Balance/AccrueInterest)
 * "" ?? null ไม่ช่วย เพราะ ?? เช็คแค่ null/undefined ไม่เช็ค empty string
 * ทำให้ insert ลง Postgres พัง (invalid input syntax for type numeric: "")
 */
const toNumericOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

/**
 * ตัดข้อความให้ไม่เกินความยาว column varchar — กัน insert ล้มเหลว (value too long for type
 * character varying) ถ้า CBS หรือ error message ส่งข้อความยาวเกินคาดมาในอนาคต
 */
const truncate = (value, maxLength) => {
    if (value == null) return null;
    const str = String(value);
    return str.length > maxLength ? str.slice(0, maxLength) : str;
};

/**
 * บันทึกไฟล์สัญญา (base64 preview ไม่เข้ารหัส) ลง tbl_contract_file + รายบัญชีที่รวมอยู่ในสัญญา
 * ลง tbl_contract_file_account (normalize แล้ว — 1 แถวต่อ 1 บัญชี พร้อม snapshot ยอดเงิน/ข้อมูล CBS
 * ณ ตอนเซ็นสัญญา) ไว้ให้ reprint ย้อนหลังได้ตรงกับที่ลูกค้าเซ็นจริง
 * ใช้ transaction เดียวกัน กันเคสไฟล์บันทึกสำเร็จแต่รายบัญชีหาย (หรือกลับกัน)
 *
 * @param {Object} params
 * @param {number} params.cusTargetId
 * @param {string} params.fileName
 * @param {string} params.base64Content - PDF เวอร์ชัน preview (ไม่เข้ารหัส) เป็น base64
 * @param {Array} params.accounts - บัญชีที่รวมอยู่ในสัญญาฉบับนี้ แต่ละตัวมี:
 *   accountNo, planNo, paymentAmount, installmentTerms,
 *   loanAmount (CBS Inquiry CreditLimit), outstandingBalance (CBS Inquiry TotalAmount),
 *   principal (CBS Inquiry Balance), interest (CBS Inquiry AccrueInterest),
 *   scheduledNextDate (CBS Inquiry ScheduledNextDate),
 *   cbsRegisterStatus/cbsRegisterDesc/cbsRegisterTimestamp (ผลลัพธ์จาก CBS Register Digitalloan
 *   Status/Desc/TimeStamp — ผลการลงทะเบียนแผน ณ ตอนเซ็นสัญญา)
 * @param {string} [createdBy='DRRS']
 */
const saveContractFileService = async ({ cusTargetId, fileName, base64Content, accounts }, createdBy = 'DRRS') => {
    try {
        const result = await AppDataSource.transaction(async (manager) => {
            const fileRepo = manager.getRepository(tblContractFile);
            const accountRepo = manager.getRepository(tblContractFileAccount);

            const savedFile = await fileRepo.save(fileRepo.create({
                cusTargetId,
                fileName,
                base64Content,
                createdBy
            }));

            const accountRows = (accounts || []).map((acc) => accountRepo.create({
                contractFileId: savedFile.id,
                accountNo: acc.accountNo,
                planNo: acc.planNo,
                paymentAmount: toNumericOrNull(acc.paymentAmount),
                // installmentTerms จาก tbl_account_installment.installment_term เป็น column numeric
                // (ค่าที่ได้มาจึงเป็น string ทศนิยม เช่น "8.00000") แต่ column ปลายทางเป็น int
                // ต้อง parseInt ก่อน ไม่งั้น insert ล้มเหลว (invalid input syntax for type integer)
                installmentTerms: acc.installmentTerms != null && acc.installmentTerms !== '' ? parseInt(acc.installmentTerms, 10) : null,
                // ชื่อ field ฝั่งเรา (loanAmount/outstandingBalance/principal/interest) map เข้า
                // ชื่อ column ที่ตรงกับ CBS (credit_limit/total_amount/balance/accrue_interest)
                // toNumericOrNull กัน CBS ส่ง "" มาแทน null จริงๆ (เจอจริงใน production log)
                creditLimit: toNumericOrNull(acc.loanAmount),
                totalAmount: toNumericOrNull(acc.outstandingBalance),
                balance: toNumericOrNull(acc.principal),
                accrueInterest: toNumericOrNull(acc.interest),
                scheduledNextDate: acc.scheduledNextDate || null,
                // ผลลัพธ์จาก CBS Register Digitalloan (ดู registerDigitalLoanService.js) — เก็บไว้
                // ยืนยันย้อนหลังได้ว่า CBS ตอบอะไรมาตอนเซ็นสัญญาฉบับนี้จริง
                cbsStatus: truncate(acc.cbsRegisterStatus, 10),
                cbsDesc: truncate(acc.cbsRegisterDesc, 200),
                cbsTimestamp: truncate(acc.cbsRegisterTimestamp, 30),
                createdBy
            }));

            if (accountRows.length > 0) {
                await accountRepo.save(accountRows);
            }

            return savedFile;
        });

        return { success: true, data: result };
    } catch (error) {
        // ไม่ throw ต่อ — บันทึกไม่สำเร็จไม่ควรทำให้ flow สร้างสัญญาหลักล้มไปด้วย
        logger.error(`บันทึกไฟล์สัญญาลง DB ไม่สำเร็จ (${fileName}): ${error.message}`);
        return { success: false, message: error.message };
    }
};

module.exports = { saveContractFileService };
