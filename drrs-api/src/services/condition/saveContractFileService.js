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
 * จำนวนครั้งที่ลองบันทึก — ลองซ้ำ 1 ครั้งถ้ารอบแรกพลาด กัน DB สะดุดชั่วคราว (connection หลุด/
 * pool เต็ม/timeout) ซึ่งเป็นเคสที่ลองใหม่แล้วผ่าน ไม่ลองมากกว่านี้เพราะถ้าพลาดเพราะตัวข้อมูล
 * (ค่าเกินขนาด column / type ไม่ตรง) ลองกี่ครั้งก็พลาดเหมือนกัน แค่หน่วงลูกค้าเปล่าๆ
 */
const SAVE_ATTEMPTS = 2;

/** หน่วงก่อนลองรอบใหม่ (มิลลิวินาที) — สั้นพอให้ connection pool ฟื้น แต่ไม่ให้ลูกค้ารอนาน */
const RETRY_DELAY_MS = 300;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * insert จริงลง 2 ตารางใน transaction เดียว — แยกออกมาเพื่อให้ตัว service ห่อ retry ได้
 * โดยไม่ต้องเขียน logic insert ซ้ำ (throw ออกไปให้ตัวห่อจัดการ ไม่จับ error ในนี้)
 */
const insertContractFile = async ({ cusTargetId, fileName, base64Content, accounts }, createdBy) => {
    return AppDataSource.transaction(async (manager) => {
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
            // NewMdt จาก CBS Inquiry LoanProcess (NEXTPLN1) — เก็บไว้ให้บัญชีที่ลงทะเบียนแล้ว
            // ดึงมาโชว์วันครบกำหนดจาก DB ได้โดยไม่ต้องยิง CBS ซ้ำ (ดู masterPlanService.js)
            newMaturityDate: acc.endDateRaw || null,
            // ผลลัพธ์จาก CBS Register Digitalloan (ดู registerDigitalLoanService.js) — เก็บไว้
            // ยืนยันย้อนหลังได้ว่า CBS ตอบอะไรมาตอนเซ็นสัญญาฉบับนี้จริง และเป็นตัวบอกหน้า reprint
            // ของ admin ว่าบัญชีไหนอยู่ในไฟล์ PDF จริง (SUCCESS) บัญชีไหนไม่อยู่ (REJECT/NOT_FOUND/ERROR)
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
 *   scheduledNextDate (CBS Inquiry ScheduledNextDate), endDateRaw (CBS Inquiry NewMdt),
 *   cbsRegisterStatus/cbsRegisterDesc/cbsRegisterTimestamp (ผลลัพธ์จาก CBS Register Digitalloan
 *   Status/Desc/TimeStamp — ผลการลงทะเบียนแผน ณ ตอนเซ็นสัญญา)
 * @param {string} [createdBy='DRRS']
 */
const saveContractFileService = async ({ cusTargetId, fileName, base64Content, accounts }, createdBy = 'DRRS') => {
    let lastError = null;

    for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt += 1) {
        try {
            const result = await insertContractFile({ cusTargetId, fileName, base64Content, accounts }, createdBy);
            if (attempt > 1) {
                logger.info(`บันทึกไฟล์สัญญาลง DB สำเร็จในรอบที่ ${attempt} (${fileName})`);
            }
            return { success: true, data: result };
        } catch (error) {
            lastError = error;
            logger.error(`บันทึกไฟล์สัญญาลง DB ไม่สำเร็จ รอบที่ ${attempt}/${SAVE_ATTEMPTS} (${fileName}): ${error.message}`);
            if (attempt < SAVE_ATTEMPTS) {
                await delay(RETRY_DELAY_MS);
            }
        }
    }

    // ไม่ throw ต่อ — บันทึกไม่สำเร็จไม่ควรทำให้ flow สร้างสัญญาหลักล้มไปด้วย เพราะ CBS
    // ลงทะเบียนแผนไปแล้ว ถ้าทำให้ request ล้ม ลูกค้าจะกดยอมรับใหม่แล้วลงทะเบียนซ้อน
    // ⚠️ ผู้เรียก "ต้อง" เช็ค success แล้วเขียน audit ลง tbl_system_log เอง ไม่ปล่อยผ่านเงียบๆ
    // เพราะเคสนี้ลูกค้าได้สัญญาจริงแต่ admin จะค้นหาสัญญาฉบับนี้ไม่เจอ
    // (ดู downloadAndEmailContractPdfController.js ขั้น STEP 2.5)
    return { success: false, message: lastError ? lastError.message : 'บันทึกไฟล์สัญญาไม่สำเร็จ' };
};

module.exports = { saveContractFileService };
