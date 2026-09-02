const { AppDataSource } = require('../../config/database');
const tblContractFile = require('../../entities/tblContractFile');
const tblContractFileAccount = require('../../entities/tblContractFileAccount');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'saveContractFileService' });

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
 *   loanAmount (CBS CreditLimit), outstandingBalance (CBS TotalAmount),
 *   principal (CBS Balance), interest (CBS AccrueInterest), scheduledNextDate (CBS ScheduledNextDate)
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
                paymentAmount: acc.paymentAmount,
                // installmentTerms จาก tbl_account_installment.installment_term เป็น column numeric
                // (ค่าที่ได้มาจึงเป็น string ทศนิยม เช่น "8.00000") แต่ column ปลายทางเป็น int
                // ต้อง parseInt ก่อน ไม่งั้น insert ล้มเหลว (invalid input syntax for type integer)
                installmentTerms: acc.installmentTerms != null ? parseInt(acc.installmentTerms, 10) : null,
                // ชื่อ field ฝั่งเรา (loanAmount/outstandingBalance/principal/interest) map เข้า
                // ชื่อ column ที่ตรงกับ CBS (credit_limit/total_amount/balance/accrue_interest)
                creditLimit: acc.loanAmount ?? null,
                totalAmount: acc.outstandingBalance ?? null,
                balance: acc.principal ?? null,
                accrueInterest: acc.interest ?? null,
                scheduledNextDate: acc.scheduledNextDate ?? null,
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
