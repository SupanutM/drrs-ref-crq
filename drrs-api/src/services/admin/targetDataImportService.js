const iconv = require('iconv-lite');
const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const tblAccountCusTarget = require('../../entities/tblAccountCusTarget');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const tblSettingsStep = require('../../entities/tblSettingsStep');
const { parseCbsDate, parseDbDate, nowBangkokDateOnly } = require('../../utils/calculateInstallmentSchedule');
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

// วันที่หมดอายุจากไฟล์ import รูปแบบ YYYYMMDD (เช่น "20260908") — ใช้ parser เดียวกับ CBS
const toDateOrNull = (value) => {
    if (value === '' || value == null) return null;
    return parseCbsDate(value);
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
 * ตำแหน่งคอลัมน์ (ไม่มี header): [ACCOUNT_NO, CIF_NO, PLAN_NO, PAYMENT_AMOUNT, INSTALLMENT_TERMS, EXPIRE_DATE]
 * ตัวอย่าง: 800000074545|5004|1|30000.00| , 800000074545|5004|2|600.00|12
 * ตัวอย่างพร้อมวันหมดอายุ (ไฟล์ U_DRRS_ACCOUNT_TARGET_YYYYMMDD.csv): 800002836745|1234|1|1500|12|20260908
 * EXPIRE_DATE เป็น optional (คอลัมน์ที่ 6) รูปแบบ YYYYMMDD — ไม่มีคอลัมน์นี้ก็ import ได้ตามปกติ (เป็น null)
 *
 * PLAN_NO: '1' = ปิดบัญชี, '2' = ผ่อนชำระ
 * เชื่อมกับลูกค้าด้วย CIF_NO (ไม่ใช่ CITIZEN_ID แบบเดิม) — ต้อง import ไฟล์ข้อมูลลูกค้าก่อนเสมอ
 *
 * การตัดสินใจทำแบบ "รายแถว" จับคู่ของเก่ากับของใหม่ด้วย key = account_no + plan_no
 * เรียงลำดับความสำคัญของเงื่อนไข "คงของเก่าไว้ (skip ไม่ import ใหม่ แค่แตะ update_date/update_by)":
 *   1) skip (send to CBS success) — บัญชีนั้นมี tbl_settings_step.step_send_to_cbs = '1'
 *      (ลูกค้าลงทะเบียนสำเร็จแล้ว) ห้ามลบเด็ดขาด ต้องคงไว้เพื่อตรวจสอบย้อนหลัง
 *   2) skip (not expired) — เฉพาะ "แผน 1 (ปิดบัญชี)" เท่านั้น: ถ้าแถวเก่า (account_no + plan_no='1')
 *      ยังมี expire_date ที่ยังไม่หมดอายุ (> วันนี้) ห้าม import ทับ — เคสนี้ต้องให้เจ้าหน้าที่ทำมือเท่านั้น
 *      (แผน 2 ไม่เช็ค expire; expire_date เป็น null ถือว่าหมดอายุ -> import ตามปกติ)
 *   นอกเหนือจากนั้น -> soft-delete ของเก่า + insert แถวใหม่จากไฟล์ (พฤติกรรมปกติ)
 *
 * audit log แยกนับตามแผน (แผน1 / แผน2): insert / skip(send to CBS success) / skip(not expired)
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
        const [accountNo, cifNo, planNo, paymentAmount, installmentTerms, expireDate] = columns;
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
            expireDate: toDateOrNull(expireDate),
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
        const stepRepo = manager.getRepository(tblSettingsStep);

        // หาลูกค้าที่ active อยู่ตอนนี้ทั้งหมด — map ด้วย cifNo เพื่อความเร็ว (ไม่ query ทีละแถว)
        const activeCustomers = await cusRepo.find({ where: { status: '1' } });
        const customerByCifNo = new Map(activeCustomers.map((c) => [c.cifNo, c]));

        // หาบัญชีที่ลูกค้าทำสำเร็จไปแล้ว (ส่ง CBS แล้ว) จาก tbl_settings_step — ห้ามแตะบัญชีเหล่านี้
        // step_send_to_cbs เป็น bpchar อาจมี space ปน จึง TRIM ก่อนเทียบ '1' (เทียบแบบเดียวกับ verify/save controller)
        const protectedSteps = await stepRepo
            .createQueryBuilder('step')
            .select('step.accountNo', 'accountNo')
            .where("TRIM(step.step_send_to_cbs) = :sent", { sent: '1' })
            .getRawMany();
        const protectedAccountSet = new Set(protectedSteps.map((s) => s.accountNo).filter(Boolean));

        // ★ อ่านไฟล์ .csv แล้วแยกออกเป็น array รายแผน (แผน1 = ปิดบัญชี, แผน2 = ผ่อนชำระ) เพื่อให้ logic
        //   ชัดเจน + ตรวจสอบ audit log ได้ง่าย — แต่ละแผนตัดสินใจด้วยกฎของตัวเอง (แผน1 เช็ค expire เพิ่ม)
        const rowsByPlan = new Map(); // planNo -> [mappedRow ที่ผ่านการ map ลูกค้าแล้ว]
        mappedRows.forEach((row) => {
            const customer = customerByCifNo.get(row.cifNo);
            if (!customer) {
                errors.push(`แถวที่ ${row.rowNumber}: ไม่พบลูกค้า CIF_NO=${row.cifNo} (ต้อง import ไฟล์ข้อมูลลูกค้าก่อน)`);
                return;
            }
            if (!rowsByPlan.has(row.planNo)) rowsByPlan.set(row.planNo, []);
            rowsByPlan.get(row.planNo).push({ ...row, cusTargetId: customer.id });
        });

        // ยกเลิกถ้าไม่มีแถวไหนเชื่อมลูกค้าได้เลย — ไม่ soft-delete ข้อมูลเดิมทิ้งเปล่าๆ
        const totalLinkedRows = [...rowsByPlan.values()].reduce((sum, list) => sum + list.length, 0);
        if (totalLinkedRows === 0) {
            return { aborted: true };
        }

        // ดึงแถวบัญชีเดิมที่ active อยู่ทั้งหมด มาทำ lookup ด้วย key = account_no + plan_no (จับคู่ของเก่า/ใหม่)
        const activeAccounts = await accRepo.find({ where: { status: '1' } });
        const existingByKey = new Map(); // "accountNo|planNo" -> แถวเดิม
        activeAccounts.forEach((acc) => existingByKey.set(`${acc.accountNo}|${acc.planNo}`, acc));

        const PLAN_CLOSE_ACCOUNT = '1'; // แผน 1 = ปิดบัญชี (แผนเดียวที่เช็ค expire_date)
        // เทียบแบบ "วันที่ล้วนๆ" ตามเวลาไทย (ตัดชั่วโมง/นาทีทิ้ง) ไม่ใช้ new Date() ตรงๆ เพราะ parseDbDate
        // คืนค่าเป็นเที่ยงคืน UTC ของวันนั้น — ถ้าเทียบกับเวลาปัจจุบันจริง ผลจะเปลี่ยนไปมาในวันเดียวกัน
        // ขึ้นกับชั่วโมงที่รัน import (เช่น import ตอนเช้ากับตอนบ่ายของวันเดียวกันได้ผลต่างกัน)
        // นโยบาย: expire_date ที่ตรงกับ "วันนี้" ถือว่า "หมดอายุแล้ว" (ต้อง > วันนี้ เท่านั้นถึงจะยัง skip)
        const today = nowBangkokDateOnly();

        const newRows = [];            // แถวที่จะ insert ใหม่
        const skipCbsIds = new Set();  // id แถวเดิมที่ skip เพราะส่ง CBS แล้ว -> แตะ update_date/by
        const skipExpiredIds = new Set(); // id แถวเดิมที่ skip เพราะแผน1 ยังไม่หมดอายุ -> แตะ update_date/by
        const keepKeys = new Set();    // key ของแถวเดิมที่ต้องคงไว้ (ไม่ soft-delete)
        // นับแยกตามแผนเพื่อ audit: { [planNo]: { inserted, skipCbs, skipExpired } }
        const planStats = {};
        const bumpStat = (planNo, field) => {
            if (!planStats[planNo]) planStats[planNo] = { inserted: 0, skipCbs: 0, skipExpired: 0 };
            planStats[planNo][field] += 1;
        };

        for (const [planNo, list] of rowsByPlan.entries()) {
            for (const row of list) {
                const key = `${row.accountNo}|${planNo}`;
                const existing = existingByKey.get(key);

                // เงื่อนไข 1: ส่ง CBS สำเร็จแล้ว — คงของเก่า ไม่ import ใหม่ (สำคัญสุด)
                if (protectedAccountSet.has(row.accountNo)) {
                    if (existing) {
                        skipCbsIds.add(existing.id);
                        keepKeys.add(key);
                    }
                    bumpStat(planNo, 'skipCbs');
                    continue;
                }

                // เงื่อนไข 2: เฉพาะแผน 1 (ปิดบัญชี) — ถ้าของเก่ายังไม่หมดอายุ ห้าม import ทับ (ทำมือเท่านั้น)
                if (planNo === PLAN_CLOSE_ACCOUNT && existing) {
                    const oldExpire = parseDbDate(existing.expireDate);
                    if (oldExpire && oldExpire > today) {
                        skipExpiredIds.add(existing.id);
                        keepKeys.add(key);
                        bumpStat(planNo, 'skipExpired');
                        continue;
                    }
                }

                // นอกเหนือจากนั้น — insert แถวใหม่จากไฟล์ (ของเก่า key เดียวกันจะถูก soft-delete)
                newRows.push({
                    cusTargetId: row.cusTargetId,
                    accountNo: row.accountNo,
                    planNo,
                    paymentAmount: row.paymentAmount,
                    installmentTerms: row.installmentTerms,
                    expireDate: row.expireDate,
                    maxAmount: null, // ไฟล์ import ไม่มีคอลัมน์นี้ — ไม่มีค่า ให้เป็น null ไม่ใช่ 0
                    status: '1',
                    createdBy: adminUsername,
                    createdDate: new Date(),
                });
                bumpStat(planNo, 'inserted');
            }
        }

        // soft-delete แถวเดิมที่ active อยู่ ยกเว้นแถวที่ต้องคงไว้ (skip CBS / skip not-expired)
        const keepIds = [...skipCbsIds, ...skipExpiredIds];
        const deleteQuery = accRepo
            .createQueryBuilder()
            .update()
            .set({ status: '0', deleteDate: () => 'CURRENT_TIMESTAMP', deleteBy: adminUsername })
            .where('status = :status', { status: '1' });
        if (keepIds.length > 0) {
            deleteQuery.andWhere('id NOT IN (:...keepIds)', { keepIds });
        }
        const deleteResult = await deleteQuery.execute();
        const deleted = deleteResult.affected ?? 0;

        const BATCH_SIZE = 1000;
        for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
            await accRepo.insert(newRows.slice(i, i + BATCH_SIZE));
        }

        // แถวเดิมที่ถูก skip (คงไว้) — แตะ update_date/update_by เพื่อบันทึกว่ามีไฟล์ import ส่งซ้ำเข้ามา
        // (ไม่แก้ค่าข้อมูลบัญชีเดิม แค่ประทับเวลาว่ามีคนพยายาม import ทับ)
        let updated = 0;
        if (keepIds.length > 0) {
            const updateResult = await accRepo
                .createQueryBuilder()
                .update()
                .set({ updateDate: () => 'CURRENT_TIMESTAMP', updateBy: adminUsername })
                .where('id IN (:...keepIds)', { keepIds })
                .execute();
            updated = updateResult.affected ?? 0;
        }

        return {
            deleted,
            inserted: newRows.length,
            updated,
            skipCbs: skipCbsIds.size,
            skipExpired: skipExpiredIds.size,
            planStats,
            aborted: false,
        };
    });

    if (result.aborted) {
        return {
            success: false,
            message: 'ไม่สามารถนำเข้าข้อมูลบัญชีได้ เนื่องจากไม่พบลูกค้าที่อ้างอิง (CIF_NO) ในระบบเลย กรุณา import ไฟล์ข้อมูลลูกค้าก่อน',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    // สรุปสถิติแยกตามแผน สำหรับ audit log (เช่น "แผน1: insert=5 skip(not expired)=2 skip(send to CBS success)=1")
    const planSummary = Object.entries(result.planStats)
        .map(([planNo, s]) => {
            const parts = [`insert=${s.inserted}`];
            if (s.skipExpired > 0) parts.push(`skip(not expired)=${s.skipExpired}`);
            if (s.skipCbs > 0) parts.push(`skip(send to CBS success)=${s.skipCbs}`);
            return `แผน${planNo}: ${parts.join(' ')}`;
        })
        .join(' | ');

    logger.info(`Import ข้อมูลบัญชี: soft-delete เดิม=${result.deleted} เพิ่มใหม่=${result.inserted} skip(CBS)=${result.skipCbs} skip(not expired)=${result.skipExpired} error=${errors.length} | ${planSummary}`);

    const skipCbsNote = result.skipCbs > 0 ? `, skip(send to CBS success) ${result.skipCbs} แถว` : '';
    const skipExpiredNote = result.skipExpired > 0 ? `, skip(not expired) ${result.skipExpired} แถว` : '';
    return {
        success: true,
        message: `นำเข้าข้อมูลบัญชีสำเร็จ (ปิดใช้งานข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว${skipCbsNote}${skipExpiredNote})`,
        data: { ...result, planSummary, errors }
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
