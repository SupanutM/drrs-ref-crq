const iconv = require('iconv-lite');
const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const tblAccountCusTarget = require('../../entities/tblAccountCusTarget');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'targetDataImportService' });

/**
 * แปลง buffer ไฟล์เป็น text — auto-detect encoding ระหว่าง UTF-8 กับ Windows-874 (TIS-620)
 *
 * เหตุผลที่ต้อง auto-detect (ไม่ hardcode windows-874 ตามที่ตกลงไว้แต่แรก): ไฟล์จริงจากทีมข้อมูล
 * พบว่าบางไฟล์ถูก save เป็น UTF-8 จริงๆ ไม่ใช่ windows-874 — ถ้า decode ผิดเป็น windows-874 ตัวอักษร
 * ไทย (multi-byte UTF-8) จะตกไปอยู่ใน byte value ที่ windows-874 ไม่มีอักขระรองรับ (undefined slot)
 * กลายเป็น U+FFFD (replacement character) แทน ซึ่งพอส่งไป Postgres (session encoding WIN874) จะ
 * insert ไม่ได้เพราะ WIN874 ก็ไม่มีอักขระนี้เหมือนกัน -> error "no equivalent in encoding WIN874"
 *
 * วิธีตรวจ: ลอง decode แบบ strict UTF-8 ก่อน (fatal:true — ถ้าไม่ใช่ UTF-8 ที่ valid จะ throw ทันที)
 * ถ้า throw แปลว่าไม่ใช่ UTF-8 จริง -> fallback ไป windows-874 (encoding ดั้งเดิมที่ทีมข้อมูลใช้)
 * รองรับ BOM ของ UTF-8 ด้วย (ตัดออกก่อน decode ถ้ามี)
 */
const decodeCsvBuffer = (buffer) => {
    let buf = buffer;
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        buf = buf.subarray(3); // ตัด UTF-8 BOM ทิ้งก่อน decode
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (e) {
        return iconv.decode(buf, 'windows-874');
    }
};

/**
 * อ่านไฟล์ .csv จาก buffer — ไม่มี header, ตำแหน่งคอลัมน์คงที่ตามไฟล์จริงจากทีมข้อมูล
 * delimiter = pipe "|" — encoding auto-detect (UTF-8 หรือ Windows-874 ดูฟังก์ชัน decodeCsvBuffer)
 * (ต้องรับเป็น .csv ดิบจากต้นทางเท่านั้น — ไฟล์ที่ผ่านการแปลงเป็น .xlsx มาก่อนทำเลขบัตรประชาชนเพี้ยน)
 * คืน rows เป็น array ของ array คอลัมน์ต่อแถว (index 0,1,2,... ตามลำดับในไฟล์)
 */
const parseCsvPipe = (buffer) => {
    const text = decodeCsvBuffer(buffer);
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    return lines.map((line, index) => ({
        rowNumber: index + 1,
        columns: line.split('|').map((col) => col.trim()),
    }));
};

const toNumericOrNull = (value) => {
    if (value === '' || value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const toIntOrNull = (value) => {
    if (value === '' || value == null) return null;
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : null;
};

/**
 * Import "ข้อมูลลูกค้า" (ไฟล์ที่ 1) เข้า tbl_cus_target
 * ตำแหน่งคอลัมน์ (ไม่มี header): [CIF_NO, CITIZEN_ID, FIRST_NAME, LAST_NAME, VERIFY_CODE, TYPE]
 * ตัวอย่าง: 5004|2110000000000|ศุภณัฐ|มณีชัย|4546|1
 *
 * นโยบาย: soft-delete แถวเดิมทั้งหมด (status='1' -> status='0' + delete_date/delete_by)
 * แล้ว insert แถวจากไฟล์เป็นแถวใหม่ทั้งหมด (ไม่ upsert ตาม citizenId แบบเดิมอีกต่อไป)
 */
const importCustomer = async (buffer, adminUsername) => {
    const rows = parseCsvPipe(buffer);
    if (rows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในไฟล์ข้อมูลลูกค้า' };
    }

    const errors = [];
    const mappedRows = [];

    rows.forEach(({ rowNumber, columns }) => {
        const [cifNo, citizenId, firstName, lastName, verifyCode, type] = columns;
        if (!cifNo || !citizenId || !firstName || !lastName || !verifyCode) {
            errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 5 คอลัมน์: CIF_NO, CITIZEN_ID, NAME, LNAME, VERIFY_CODE)`);
            return;
        }
        mappedRows.push({ cifNo, citizenId, firstName, lastName, verifyCode, type: type || null });
    });

    // กันเคสทุกแถวไม่ผ่าน validation — ห้าม soft-delete ข้อมูลเดิมทิ้งโดยไม่มีข้อมูลใหม่มาแทนที่
    if (mappedRows.length === 0) {
        return {
            success: false,
            message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (ทุกแถวข้อมูลไม่ครบ) ยกเลิกการนำเข้า ข้อมูลเดิมไม่ถูกแก้ไข',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    const result = await AppDataSource.transaction(async (manager) => {
        // แก้ปัญหาตัวหนังสือไทยเพี้ยนตอน insert (DB server เป็น WIN874 แต่ backend ส่ง UTF-8) —
        // ผูกกับ transaction นี้เท่านั้น (ดูรายละเอียดที่ masterDataImportService.replaceAllRows)
        await manager.query("SET LOCAL client_encoding TO 'UTF8'");

        const repo = manager.getRepository(tblCusTarget);

        const deleteResult = await repo
            .createQueryBuilder()
            .update()
            .set({ status: '0', deleteDate: () => 'CURRENT_TIMESTAMP', deleteBy: adminUsername })
            .where('status = :status', { status: '1' })
            .execute();
        const deleted = deleteResult.affected ?? 0;

        const newRows = mappedRows.map((row) => ({
            ...row,
            status: '1',
            createdBy: adminUsername,
            createdDate: new Date(),
        }));

        // แบ่ง batch กันชน parameter limit ของ PostgreSQL (65535) เผื่อไฟล์มีจำนวนแถวมาก
        const BATCH_SIZE = 1000;
        for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
            await repo.insert(newRows.slice(i, i + BATCH_SIZE));
        }

        return { deleted, inserted: newRows.length };
    });

    logger.info(`Import ข้อมูลลูกค้า: soft-delete เดิม=${result.deleted} เพิ่มใหม่=${result.inserted} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าข้อมูลลูกค้าสำเร็จ (ปิดใช้งานข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว)`,
        data: { ...result, errors }
    };
};

/**
 * Import "ข้อมูลบัญชี" (ไฟล์ที่ 2) เข้า tbl_account_cus_target
 * ตำแหน่งคอลัมน์ (ไม่มี header): [ACCOUNT_NO, CIF_NO, PLAN_NO, PAYMENT_AMOUNT, INSTALLMENT_TERMS]
 * ตัวอย่าง: 800000074545|5004|1|30000.00| , 800000074545|5004|2|600.00|12
 *
 * เชื่อมกับลูกค้าด้วย CIF_NO (ไม่ใช่ CITIZEN_ID แบบเดิม) — ต้อง import ไฟล์ข้อมูลลูกค้าก่อนเสมอ
 * นโยบาย: soft-delete แถวเดิมทั้งหมดแล้ว insert แถวจากไฟล์เป็นแถวใหม่ทั้งหมด (เหมือนไฟล์ลูกค้า)
 * min_amount ไม่ใช้แล้ว (ใช้ payment_amount แทน) — ไม่ set ค่านี้จากไฟล์อีกต่อไป
 */
const importAccount = async (buffer, adminUsername) => {
    const rows = parseCsvPipe(buffer);
    if (rows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในไฟล์ข้อมูลบัญชี' };
    }

    const errors = [];
    const mappedRows = [];

    rows.forEach(({ rowNumber, columns }) => {
        const [accountNo, cifNo, planNo, paymentAmount, installmentTerms] = columns;
        if (!accountNo || !cifNo || !planNo) {
            errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 3 คอลัมน์แรก: ACCOUNT_NO, CIF_NO, PLAN_NO)`);
            return;
        }
        mappedRows.push({
            rowNumber,
            accountNo,
            cifNo,
            planNo,
            paymentAmount: toNumericOrNull(paymentAmount),
            installmentTerms: toIntOrNull(installmentTerms),
        });
    });

    if (mappedRows.length === 0) {
        return {
            success: false,
            message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (ทุกแถวข้อมูลไม่ครบ) ยกเลิกการนำเข้า ข้อมูลเดิมไม่ถูกแก้ไข',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    const result = await AppDataSource.transaction(async (manager) => {
        await manager.query("SET LOCAL client_encoding TO 'UTF8'");

        const cusRepo = manager.getRepository(tblCusTarget);
        const accRepo = manager.getRepository(tblAccountCusTarget);

        // หาลูกค้าที่ active อยู่ตอนนี้ทั้งหมด — map ด้วย cifNo เพื่อความเร็ว (ไม่ query ทีละแถว)
        const activeCustomers = await cusRepo.find({ where: { status: '1' } });
        const customerByCifNo = new Map(activeCustomers.map((c) => [c.cifNo, c]));

        const newRows = [];
        mappedRows.forEach(({ rowNumber, accountNo, cifNo, planNo, paymentAmount, installmentTerms }) => {
            const customer = customerByCifNo.get(cifNo);
            if (!customer) {
                errors.push(`แถวที่ ${rowNumber}: ไม่พบลูกค้า CIF_NO=${cifNo} (ต้อง import ไฟล์ข้อมูลลูกค้าก่อน)`);
                return;
            }
            newRows.push({
                cusTargetId: customer.id,
                accountNo,
                planNo,
                paymentAmount,
                installmentTerms,
                maxAmount: null, // ไฟล์ import ไม่มีคอลัมน์นี้ — ไม่มีค่า ให้เป็น null ไม่ใช่ 0
                status: '1',
                createdBy: adminUsername,
                createdDate: new Date(),
            });
        });

        if (newRows.length === 0) {
            // ไม่มีแถวไหนเชื่อมลูกค้าได้เลย — ยกเลิก ไม่ soft-delete ข้อมูลเดิมทิ้งเปล่าๆ
            return { deleted: 0, inserted: 0, aborted: true };
        }

        const deleteResult = await accRepo
            .createQueryBuilder()
            .update()
            .set({ status: '0', deleteDate: () => 'CURRENT_TIMESTAMP', deleteBy: adminUsername })
            .where('status = :status', { status: '1' })
            .execute();
        const deleted = deleteResult.affected ?? 0;

        const BATCH_SIZE = 1000;
        for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
            await accRepo.insert(newRows.slice(i, i + BATCH_SIZE));
        }

        return { deleted, inserted: newRows.length, aborted: false };
    });

    if (result.aborted) {
        return {
            success: false,
            message: 'ไม่สามารถนำเข้าข้อมูลบัญชีได้ เนื่องจากไม่พบลูกค้าที่อ้างอิง (CIF_NO) ในระบบเลย กรุณา import ไฟล์ข้อมูลลูกค้าก่อน',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    logger.info(`Import ข้อมูลบัญชี: soft-delete เดิม=${result.deleted} เพิ่มใหม่=${result.inserted} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าข้อมูลบัญชีสำเร็จ (ปิดใช้งานข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว)`,
        data: { ...result, errors }
    };
};

/**
 * Import "ข้อมูลแผน" (ไฟล์ที่ 3) เข้า tbl_mt_master_plan
 * ตำแหน่งคอลัมน์ (ไม่มี header): [CODE, LOAN_TYPE, DESC_TH, DESC_EN, CHECK_INCOME]
 * ตัวอย่าง: 1|HC|ปิดยอด|HAIRCUT|0 , 2|LT|ผ่อนชำระ|Installment Terms|1
 * CODE เป็นรหัสแผนใหม่ (เลข) แทนที่ HC/LT เดิม — ไฟล์บัญชีอ้างอิง PLAN_NO ตามรหัสนี้
 * CHECK_INCOME ส่งมาเป็น "0" หรือ "1" ตัวเดียว (ไม่ใช่ TRUE/FALSE แบบไฟล์เดิม)
 * Upsert ตาม CODE (primary key) — update ทั้ง desc_en / desc_th / is_check_income / loan_type ทุกครั้ง
 */
const importPlan = async (buffer, adminUsername) => {
    const rows = parseCsvPipe(buffer);
    if (rows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในไฟล์ข้อมูลแผน' };
    }

    const errors = [];
    const mappedRows = [];

    rows.forEach(({ rowNumber, columns }) => {
        const [code, loanType, descTh, descEn, checkIncome] = columns;
        if (!code || !descEn) {
            errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี CODE และ DESC_EN)`);
            return;
        }
        const isCheckIncome = checkIncome === '0' ? '0' : '1';
        mappedRows.push({ code, loanType: loanType || null, descTh: descTh || null, descEn, isCheckIncome });
    });

    if (mappedRows.length === 0) {
        return { success: false, message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (CODE/DESC_EN ไม่ครบ)', data: { inserted: 0, updated: 0, errors } };
    }

    let inserted = 0;
    let updated = 0;

    await AppDataSource.transaction(async (manager) => {
        await manager.query("SET LOCAL client_encoding TO 'UTF8'");

        const repo = manager.getRepository(tblMtMasterPlan);

        for (const { code, loanType, descTh, descEn, isCheckIncome } of mappedRows) {
            const payload = { code, loanType, descTh, descEn, isCheckIncome, status: '1' };

            const existing = await repo.findOne({ where: { code } });
            if (existing) {
                Object.assign(existing, payload, { updateBy: adminUsername, updateDate: new Date() });
                await repo.save(existing);
                updated++;
            } else {
                await repo.save(repo.create({ ...payload, createdBy: adminUsername }));
                inserted++;
            }
        }
    });

    logger.info(`Import ข้อมูลแผน: insert=${inserted} update=${updated} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าข้อมูลแผนสำเร็จ (เพิ่มใหม่ ${inserted}, อัปเดต ${updated})`,
        data: { inserted, updated, errors }
    };
};

module.exports = {
    importCustomer,
    importAccount,
    importPlan,
};
