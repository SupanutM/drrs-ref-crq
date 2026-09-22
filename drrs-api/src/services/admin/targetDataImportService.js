const iconv = require('iconv-lite');
const { In } = require('typeorm');
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

// จำนวนข้อความแจ้งเตือน "แถวซ้ำ" สูงสุดที่ส่งกลับ/เก็บลง audit log (กัน payload บวมถ้าไฟล์เพี้ยนหนัก)
// ตัวนับจำนวนจริง (duplicateCount) ยังนับครบทุกแถวเสมอ ไม่ถูกจำกัดด้วยค่านี้
const DUP_WARNING_LIMIT = 200;

/**
 * ตัดแถวซ้ำภายใน "ไฟล์เดียวกัน" — นโยบาย: ★ เชื่อแถวล่าสุดเสมอ (แถวที่อยู่ล่างกว่าในไฟล์ชนะ)
 *
 * เหตุผลที่ต้องตัดตรงนี้ก่อนเข้า DB: map ที่ใช้จับคู่ของเก่ากับของใหม่ (customerByCifNo /
 * existingByKey) สร้างจากข้อมูลใน DB "ครั้งเดียว" ก่อนเข้า loop และ insert เกิดขึ้นหลัง loop จบ
 * แถวซ้ำแถวที่ 2 จึงมองไม่เห็นแถวที่ 1 -> ได้แถว active key เดียวกันซ้อน 2 แถวใน DB
 * (เคสนี้เกิดเฉพาะ key ที่ยังไม่มีใน DB เลย ถ้ามีอยู่แล้วทั้งคู่จะเข้าทาง update ทับกันเอง)
 *
 * ลำดับผลลัพธ์: เรียงตามตำแหน่งที่ key นั้นโผล่ "ครั้งแรก" ในไฟล์ แต่ข้อมูลเป็นของแถว "ล่าสุด"
 * (Map ของ JS คงตำแหน่งเดิมไว้เมื่อ set ทับ key ที่มีอยู่แล้ว)
 *
 * @param {Array} rows - แถวที่ map แล้ว ต้องมี rowNumber ติดมาด้วย
 * @param {Function} keyOf - (row) => key ที่ใช้ตัดซ้ำ (ลูกค้า = CIF_NO, บัญชี = account_no|plan_no)
 * @param {Function} describe - (winnerRow) => ข้อความอธิบายแถว สำหรับแจ้งเตือนเจ้าหน้าที่
 * @returns {{ rows: Array, warnings: string[], duplicateCount: number }}
 */
const dedupeKeepLast = (rows, keyOf, describe) => {
    const winnerByKey = new Map();   // key -> แถวล่าสุดที่เจอ (ตัวที่จะใช้จริง)
    const droppedByKey = new Map();  // key -> [เลขแถวที่ถูกทิ้ง] เรียงตามที่เจอในไฟล์

    rows.forEach((row) => {
        const key = keyOf(row);
        const previous = winnerByKey.get(key);
        if (previous) {
            if (!droppedByKey.has(key)) droppedByKey.set(key, []);
            droppedByKey.get(key).push(previous.rowNumber);
        }
        winnerByKey.set(key, row); // แถวล่าสุดทับแถวเดิมเสมอ (คงตำแหน่งเดิมใน Map)
    });

    const warnings = [];
    let duplicateCount = 0;
    droppedByKey.forEach((droppedRowNumbers, key) => {
        duplicateCount += droppedRowNumbers.length;
        if (warnings.length >= DUP_WARNING_LIMIT) return;
        const winner = winnerByKey.get(key);
        const allRowNumbers = [...droppedRowNumbers, winner.rowNumber].join(', ');
        warnings.push(
            `${describe(winner)} ซ้ำในไฟล์ ${droppedRowNumbers.length + 1} แถว (แถวที่ ${allRowNumbers}) — ใช้ข้อมูลจากแถวล่าสุด คือแถวที่ ${winner.rowNumber}`
        );
    });

    return { rows: [...winnerByKey.values()], warnings, duplicateCount };
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
 * ★ Upsert ตาม CIF_NO (ไม่ใช่ full-refresh แบบเดิมแล้ว — แก้บั๊ก 2026-09-15):
 *   เดิม soft-delete ลูกค้าทั้งหมดแล้ว insert ใหม่ทุกครั้ง ทำให้ลูกค้าคนเดิมได้ id (cus_target_id)
 *   ใหม่ทุกรอบที่ import ซ้ำ — แต่ไฟล์บัญชี (importAccount) เป็น "delta" ไม่แตะบัญชีที่ไม่ได้อยู่ใน
 *   ไฟล์รอบนั้น ทำให้บัญชีที่ไม่ถูก import ซ้ำยังชี้ไปที่ cus_target_id เดิมที่ตอนนี้ status='0'
 *   ไปแล้ว (บัญชีอ้างลูกค้าที่ "ถูกลบ" ทั้งที่จริงเป็นคนเดิม) ต้องคง id ให้เสถียรข้ามรอบ import
 *
 * พฤติกรรมใหม่:
 *   - CIF_NO ตรงกับลูกค้า active (status='1') ที่มีอยู่แล้ว -> UPDATE แถวเดิม (คง id เดิม)
 *   - CIF_NO ตรงกับลูกค้าที่ถูก soft-delete ไว้ (status='0') -> ★ REVIVE แถวเดิม (คง id เดิม)
 *     ดูเหตุผลที่ต้องปลุกกลับด้านล่าง
 *   - CIF_NO ไม่ตรงกับใครเลย -> INSERT แถวใหม่
 *   - ลูกค้า active ที่ "หายไปจากไฟล์รอบนี้" -> soft-delete (คงพฤติกรรม full-refresh เดิมไว้บางส่วน
 *     คือปิดคนที่ไม่มีในไฟล์แล้วจริงๆ) ยกเว้นมีบัญชีที่ส่ง CBS สำเร็จแล้ว (step_send_to_cbs='1')
 *     ห้าม soft-delete เด็ดขาด กันเคสไฟล์ตกหล่นบางวันแล้วลูกค้าที่ลงทะเบียนสำเร็จหายไปจากระบบ
 *
 * ★★ ต้อง "ปลุก" (revive) แถวที่ถูก soft-delete กลับมา ห้าม insert แถวใหม่ (แก้บั๊ก 2026-09-22):
 *   ไฟล์ลูกค้าเป็น full-refresh (ไม่มีในไฟล์ = soft-delete) แต่ไฟล์บัญชีเป็น delta (ไม่มีในไฟล์ =
 *   ไม่แตะ) สองอันไม่สมมาตรกัน ถ้าจับคู่ CIF_NO เฉพาะลูกค้า active จะเกิดทางเดินบั๊กนี้:
 *     วันที่ 1: ลูกค้า A (CIF 5004) อยู่ในไฟล์ -> cus_target_id = 10, บัญชีของ A ชี้ id 10
 *     วันที่ 2: ไฟล์ตกหล่นไม่มี A -> A ถูก soft-delete (id 10 ตาย) แต่บัญชียังชี้ id 10
 *     วันที่ 3: A กลับมาในไฟล์ -> หาไม่เจอเพราะดูแต่ active -> insert ใหม่เป็น id 77
 *     ผลลัพธ์: A ใช้ id 77 แต่บัญชีเก่าที่ไฟล์บัญชีไม่ได้ส่งมาซ้ำยังผูก id 10 ที่ตายแล้วถาวร
 *             -> ลูกค้าเข้าระบบมาไม่เห็นบัญชีตัวเอง
 *   จึงต้องจับคู่ CIF_NO กับลูกค้า "ทุก status" แล้วปลุกแถวเดิมกลับ (คง id เดิมไว้เสมอ)
 *   กรณี CIF เดียวมีหลายแถวค้างจากยุค full-refresh: เลือกปลุกแถวที่ "บัญชี active ชี้อยู่" ก่อน
 *   เพราะเป็นแถวเดียวที่ปลุกแล้วแก้อาการบัญชีหลุดได้จริง (ดู pickCustomerRow)
 */
const importCustomer = async (buffer, adminUsername) => {
    const rows = parseCsvPipe(buffer);
    if (rows.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในไฟล์ข้อมูลลูกค้า' };
    }

    const errors = [];
    const parsedRows = [];

    rows.forEach(({ rowNumber, columns }) => {
        const [cifNo, citizenId, firstName, lastName, verifyCode, type] = columns;
        if (!cifNo || !citizenId || !firstName || !lastName || !verifyCode) {
            errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 5 คอลัมน์: CIF_NO, CITIZEN_ID, NAME, LNAME, VERIFY_CODE)`);
            return;
        }
        parsedRows.push({ rowNumber, cifNo, citizenId, firstName, lastName, verifyCode, type: type || null });
    });

    // ★ ตัดแถวซ้ำภายในไฟล์ (key = CIF_NO) — เชื่อแถวล่าสุดในไฟล์เสมอ แล้วแจ้งเตือนเจ้าหน้าที่
    //   ถ้าไม่ตัด CIF ใหม่ที่ซ้ำในไฟล์เดียวกันจะถูก insert ซ้ำเป็น 2 แถว active (ดู dedupeKeepLast)
    const { rows: mappedRows, warnings, duplicateCount } = dedupeKeepLast(
        parsedRows,
        (row) => row.cifNo,
        (row) => `CIF_NO=${row.cifNo}`
    );

    // กันเคสทุกแถวไม่ผ่าน validation — ห้าม soft-delete ข้อมูลเดิมทิ้งโดยไม่มีข้อมูลใหม่มาแทนที่
    if (mappedRows.length === 0) {
        return {
            success: false,
            message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (ทุกแถวข้อมูลไม่ครบ) ยกเลิกการนำเข้า ข้อมูลเดิมไม่ถูกแก้ไข',
            data: { deleted: 0, inserted: 0, errors, warnings, duplicateCount }
        };
    }

    const result = await AppDataSource.transaction(async (manager) => {
        // แก้ปัญหาตัวหนังสือไทยเพี้ยนตอน insert (DB server เป็น WIN874 แต่ backend ส่ง UTF-8) —
        // ผูกกับ transaction นี้เท่านั้น (ดูรายละเอียดที่ masterDataImportService.replaceAllRows)
        await manager.query("SET LOCAL client_encoding TO 'UTF8'");

        const cusRepo = manager.getRepository(tblCusTarget);
        const accRepo = manager.getRepository(tblAccountCusTarget);
        const stepRepo = manager.getRepository(tblSettingsStep);

        // ★ ดึงลูกค้า "ทุก status" (ไม่ใช่แค่ active) — ต้องเห็นแถวที่ถูก soft-delete ไว้ด้วย เพื่อ
        //   ปลุกกลับแทนการ insert แถวใหม่ (เหตุผลเต็มอยู่ใน jsdoc ของฟังก์ชันนี้)
        //   select เฉพาะคอลัมน์ที่ใช้จับคู่ ไม่ดึงข้อมูลส่วนบุคคล (ชื่อ/เลขบัตร) เข้า memory ทั้งตาราง
        const allCustomers = await cusRepo.find({ select: { id: true, cifNo: true, status: true } });
        const isActiveRow = (row) => String(row.status ?? '').trim() === '1';
        const activeCustomers = allCustomers.filter(isActiveRow);

        // cus_target_id ที่ยังมีบัญชี active ผูกอยู่ — ใช้ตัดสินว่าจะปลุกแถวไหนในกรณี CIF เดียวมี
        // หลายแถวค้างจากยุค full-refresh (ปลุกแถวที่บัญชีชี้อยู่ ถึงจะแก้อาการบัญชีหลุดได้จริง)
        const linkedAccounts = await accRepo.find({ select: { cusTargetId: true }, where: { status: '1' } });
        const linkedCustomerIds = new Set(linkedAccounts.map((a) => a.cusTargetId));

        /**
         * เลือกแถวตัวแทน 1 แถวต่อ 1 CIF_NO เรียงตามลำดับความสำคัญ:
         *   1) แถว active ที่มีบัญชี active ผูกอยู่ (ของจริงที่ใช้งานกันอยู่)
         *   2) แถว active อื่น — เอา id น้อยสุด (แถวดั้งเดิมที่สุด)
         *   3) แถวที่ถูกลบแต่มีบัญชี active ผูกอยู่ — เอา id มากสุด (ปลุกแถวนี้แล้วบัญชีกลับมาเชื่อมได้)
         *   4) แถวที่ถูกลบล่าสุด — เอา id มากสุด
         */
        const pickCustomerRow = (rows) => {
            const actives = rows.filter(isActiveRow).sort((a, b) => a.id - b.id);
            const deleted = rows.filter((r) => !isActiveRow(r)).sort((a, b) => b.id - a.id);
            return (
                actives.find((r) => linkedCustomerIds.has(r.id)) ||
                actives[0] ||
                deleted.find((r) => linkedCustomerIds.has(r.id)) ||
                deleted[0] ||
                null
            );
        };

        const rowsByCifNo = new Map();
        allCustomers.forEach((c) => {
            if (!c.cifNo) return; // cif_no เป็น nullable — แถวที่ไม่มี cif จับคู่กับไฟล์ไม่ได้
            if (!rowsByCifNo.has(c.cifNo)) rowsByCifNo.set(c.cifNo, []);
            rowsByCifNo.get(c.cifNo).push(c);
        });
        const customerByCifNo = new Map();
        rowsByCifNo.forEach((rows, cifNo) => {
            const picked = pickCustomerRow(rows);
            if (picked) customerByCifNo.set(cifNo, picked);
        });

        // หาลูกค้าที่มีบัญชีส่ง CBS สำเร็จแล้ว (step_send_to_cbs='1') — ห้าม soft-delete แม้หายไป
        // จากไฟล์รอบนี้ (เหตุผลเดียวกับที่ importAccount ป้องกันบัญชีกลุ่มนี้ไว้)
        const protectedSteps = await stepRepo
            .createQueryBuilder('step')
            .select('step.accountNo', 'accountNo')
            .where("TRIM(step.step_send_to_cbs) = :sent", { sent: '1' })
            .getRawMany();
        const protectedAccountNos = protectedSteps.map((s) => s.accountNo).filter(Boolean);
        let protectedCustomerIds = new Set();
        if (protectedAccountNos.length > 0) {
            const protectedAccounts = await accRepo.find({
                select: { cusTargetId: true },
                where: { accountNo: In(protectedAccountNos) }
            });
            protectedCustomerIds = new Set(protectedAccounts.map((a) => a.cusTargetId));
        }

        const keptIds = new Set(); // id ลูกค้าเดิมที่ยังอยู่ในไฟล์รอบนี้ (update แทน insert)
        const revivedIds = new Set(); // id ที่ถูกปลุกจาก status='0' กลับมา '1' รอบนี้ (ไว้ log/ตรวจย้อนหลัง)
        const newRows = [];

        for (const row of mappedRows) {
            const existing = customerByCifNo.get(row.cifNo);
            if (existing) {
                keptIds.add(existing.id);
                const patch = {
                    citizenId: row.citizenId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    verifyCode: row.verifyCode,
                    type: row.type,
                    updateBy: adminUsername,
                    updateDate: new Date(),
                };
                // ★ แถวเดิมถูก soft-delete ไว้ (หายจากไฟล์รอบก่อนๆ) แต่กลับมาในไฟล์รอบนี้ -> ปลุกกลับ
                //   คง id เดิมไว้ บัญชีที่ผูก cus_target_id นี้อยู่จึงไม่หลุด (ล้าง delete_date/by ด้วย
                //   ไม่งั้นแถวจะดูเหมือนยังถูกลบอยู่ และ query ที่กรอง delete_date IS NULL จะมองไม่เห็น)
                if (!isActiveRow(existing)) {
                    patch.status = '1';
                    patch.deleteDate = null;
                    patch.deleteBy = null;
                    revivedIds.add(existing.id);
                }
                await cusRepo.update(existing.id, patch);
            } else {
                // ระบุคอลัมน์เองทีละตัว ไม่ spread ...row เพราะ row มี rowNumber (ใช้ตัดแถวซ้ำ/แจ้งเตือน)
                // ติดมาด้วย ซึ่งไม่ใช่คอลัมน์ในตาราง
                newRows.push({
                    cifNo: row.cifNo,
                    citizenId: row.citizenId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    verifyCode: row.verifyCode,
                    type: row.type,
                    status: '1',
                    createdBy: adminUsername,
                    createdDate: new Date(),
                });
            }
        }

        // แบ่ง batch กันชน parameter limit ของ PostgreSQL (65535) เผื่อไฟล์มีจำนวนแถวมาก
        const BATCH_SIZE = 1000;
        for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
            await cusRepo.insert(newRows.slice(i, i + BATCH_SIZE));
        }

        // soft-delete เฉพาะลูกค้า active ที่ "หายไปจากไฟล์รอบนี้จริงๆ" (ไม่อยู่ใน keptIds) และไม่ใช่
        // ลูกค้าที่มีบัญชีส่ง CBS สำเร็จแล้ว (protectedCustomerIds)
        const idsToDelete = activeCustomers
            .filter((c) => !keptIds.has(c.id) && !protectedCustomerIds.has(c.id))
            .map((c) => c.id);
        let deleted = 0;
        if (idsToDelete.length > 0) {
            const deleteResult = await cusRepo
                .createQueryBuilder()
                .update()
                .set({ status: '0', deleteDate: () => 'CURRENT_TIMESTAMP', deleteBy: adminUsername })
                .where('status = :status', { status: '1' })
                .andWhere('id IN (:...idsToDelete)', { idsToDelete })
                .execute();
            deleted = deleteResult.affected ?? 0;
        }

        // เก็บ id ที่ปลุกกลับไว้ใน audit ด้วย (จำกัดจำนวนกัน payload บวม) — เป็น cus_target_id
        // ไม่ใช่ CIF/เลขบัตร จึงตรวจย้อนหลังได้โดยไม่เขียนข้อมูลส่วนบุคคลลง log
        const REVIVED_SAMPLE_LIMIT = 500;
        const revivedIdList = [...revivedIds];

        return {
            deleted,
            inserted: newRows.length,
            updated: keptIds.size - revivedIds.size, // แยก revive ออกจาก update ธรรมดา ไม่นับซ้ำ
            revived: revivedIds.size,
            revivedCusTargetIds: revivedIdList.slice(0, REVIVED_SAMPLE_LIMIT),
            revivedIdsTruncated: revivedIdList.length > REVIVED_SAMPLE_LIMIT,
        };
    });

    logger.info(`Import ข้อมูลลูกค้า: อัปเดต=${result.updated} ปลุกกลับ(revive)=${result.revived} เพิ่มใหม่=${result.inserted} soft-delete(หายจากไฟล์)=${result.deleted} error=${errors.length}`);
    // log แยกอีกบรรทัดเฉพาะเคส revive เพราะเป็นเคสผิดปกติที่ต้องตามดู (ลูกค้าเคยหายจากไฟล์แล้วกลับมา)
    // log แค่ cus_target_id ห้าม log CIF/เลขบัตร/ชื่อ ตามนโยบายข้อมูลอ่อนไหว
    if (result.revived > 0) {
        const idsText = result.revivedCusTargetIds.join(',') + (result.revivedIdsTruncated ? ',...' : '');
        logger.warn(`Import ข้อมูลลูกค้า: ปลุกลูกค้าที่ถูกปิดใช้งานกลับมา ${result.revived} ราย (คง cus_target_id เดิมไว้ บัญชีที่ผูกอยู่ไม่หลุด) cus_target_id=[${idsText}] by=${adminUsername}`);
    }

    // แจ้งเตือนแถวซ้ำในไฟล์ — log แค่จำนวน ไม่ log CIF (ตัว CIF อยู่ใน warnings ที่ส่งให้เจ้าหน้าที่
    // และถูกเก็บลง tbl_admin_system_log พร้อม response อยู่แล้ว)
    if (duplicateCount > 0) {
        logger.warn(`Import ข้อมูลลูกค้า: พบ CIF_NO ซ้ำในไฟล์ ตัดออก ${duplicateCount} แถว (ใช้ข้อมูลแถวล่าสุดของแต่ละ CIF) by=${adminUsername}`);
    }

    const revivedNote = result.revived > 0 ? `, ปลุกกลับจากที่ถูกปิดใช้งาน ${result.revived} แถว` : '';
    const dupNote = duplicateCount > 0 ? `, ตัดแถวซ้ำในไฟล์ ${duplicateCount} แถว (ใช้ข้อมูลแถวล่าสุด)` : '';
    return {
        success: true,
        message: `นำเข้าข้อมูลลูกค้าสำเร็จ (อัปเดต ${result.updated} แถว, เพิ่มใหม่ ${result.inserted} แถว${revivedNote}, ปิดใช้งานที่หายไปจากไฟล์ ${result.deleted} แถว${dupNote})`,
        data: { ...result, errors, warnings, duplicateCount }
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
 * ★ แบบ delta (ไม่ใช่ full-refresh): soft-delete "เฉพาะ" บัญชี+แผน (account_no + plan_no) ที่มีในไฟล์
 *   รอบนี้เท่านั้น แล้วแทนด้วยแถวใหม่ — บัญชี/แผนที่ไม่ได้อยู่ในไฟล์รอบนี้ "ไม่ถูกแตะ" (คงข้อมูลเดิมไว้)
 *   สำคัญ: importCustomer เป็น upsert ตาม CIF_NO แล้ว (คง cus_target_id เดิมไว้ข้ามรอบ import)
 *   ทำให้ customer.id ที่ map ผ่าน customerByCifNo ด้านล่างเสถียร ไม่เปลี่ยนทุกรอบเหมือนเมื่อก่อน
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
    const parsedRows = [];

    rows.forEach(({ rowNumber, columns }) => {
        const [accountNo, cifNo, planNo, paymentAmount, installmentTerms, expireDate] = columns;
        if (!accountNo || !cifNo || !planNo) {
            errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 3 คอลัมน์แรก: ACCOUNT_NO, CIF_NO, PLAN_NO)`);
            return;
        }
        parsedRows.push({
            rowNumber,
            accountNo,
            cifNo,
            planNo,
            paymentAmount: toNumericOrNull(paymentAmount),
            installmentTerms: toIntOrNull(installmentTerms),
            expireDate: toDateOrNull(expireDate),
        });
    });

    // ★ ตัดแถวซ้ำภายในไฟล์ (key = account_no + plan_no — key เดียวกับที่ใช้จับคู่ของเก่า/ของใหม่)
    //   เชื่อแถวล่าสุดในไฟล์เสมอ แล้วแจ้งเตือนเจ้าหน้าที่ ถ้าไม่ตัด: ของเก่าถูก soft-delete ครั้งเดียว
    //   แต่ insert ใหม่ 2 แถว -> บัญชีเดียวมีแผนเดียวกัน active ซ้อนกัน (ลูกค้าเห็นแผนซ้ำ)
    const { rows: mappedRows, warnings, duplicateCount } = dedupeKeepLast(
        parsedRows,
        (row) => `${row.accountNo}|${row.planNo}`,
        (row) => `บัญชี ${row.accountNo} แผน ${row.planNo}`
    );

    if (mappedRows.length === 0) {
        return {
            success: false,
            message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (ทุกแถวข้อมูลไม่ครบ) ยกเลิกการนำเข้า ข้อมูลเดิมไม่ถูกแก้ไข',
            data: { deleted: 0, inserted: 0, errors, warnings, duplicateCount }
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
        const replacedOldIds = new Set(); // id แถวเดิมที่ถูกไฟล์รอบนี้แทนที่ (key เดียวกัน) -> soft-delete
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
                    }
                    bumpStat(planNo, 'skipCbs');
                    continue;
                }

                // เงื่อนไข 2: เฉพาะแผน 1 (ปิดบัญชี) — ถ้าของเก่ายังไม่หมดอายุ ห้าม import ทับ (ทำมือเท่านั้น)
                if (planNo === PLAN_CLOSE_ACCOUNT && existing) {
                    const oldExpire = parseDbDate(existing.expireDate);
                    if (oldExpire && oldExpire > today) {
                        skipExpiredIds.add(existing.id);
                        bumpStat(planNo, 'skipExpired');
                        continue;
                    }
                }

                // นอกเหนือจากนั้น — insert แถวใหม่จากไฟล์ + soft-delete ของเก่า "key เดียวกัน" (ถ้ามี)
                // สำคัญ: ปิดเฉพาะบัญชี+แผนที่อยู่ในไฟล์รอบนี้เท่านั้น บัญชีอื่นที่ไม่อยู่ในไฟล์ไม่ถูกแตะ
                if (existing) {
                    replacedOldIds.add(existing.id);
                }
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

        // soft-delete "เฉพาะ" แถวเดิมที่ถูกไฟล์รอบนี้แทนที่ (key = account_no + plan_no ตรงกับในไฟล์)
        // แบบ delta: บัญชี/แผนที่ไม่ได้อยู่ในไฟล์รอบนี้ จะไม่ถูกปิดใช้งาน (คงข้อมูลเดิมไว้)
        const replacedIds = [...replacedOldIds];
        let deleted = 0;
        if (replacedIds.length > 0) {
            const deleteResult = await accRepo
                .createQueryBuilder()
                .update()
                .set({ status: '0', deleteDate: () => 'CURRENT_TIMESTAMP', deleteBy: adminUsername })
                .where('status = :status', { status: '1' })
                .andWhere('id IN (:...replacedIds)', { replacedIds })
                .execute();
            deleted = deleteResult.affected ?? 0;
        }

        const BATCH_SIZE = 1000;
        for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
            await accRepo.insert(newRows.slice(i, i + BATCH_SIZE));
        }

        // แถวเดิมที่ถูก skip (คงไว้) — แตะ update_date/update_by เพื่อบันทึกว่ามีไฟล์ import ส่งซ้ำเข้ามา
        // (ไม่แก้ค่าข้อมูลบัญชีเดิม แค่ประทับเวลาว่ามีคนพยายาม import ทับ)
        const skippedIds = [...skipCbsIds, ...skipExpiredIds];
        let updated = 0;
        if (skippedIds.length > 0) {
            const updateResult = await accRepo
                .createQueryBuilder()
                .update()
                .set({ updateDate: () => 'CURRENT_TIMESTAMP', updateBy: adminUsername })
                .where('id IN (:...skippedIds)', { skippedIds })
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
            data: { deleted: 0, inserted: 0, errors, warnings, duplicateCount }
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

    // แจ้งเตือนแถวซ้ำในไฟล์ — log แค่จำนวน ไม่ log เลขบัญชี (รายละเอียดอยู่ใน warnings ที่ส่งกลับ
    // และถูกเก็บลง tbl_admin_system_log พร้อม response อยู่แล้ว)
    if (duplicateCount > 0) {
        logger.warn(`Import ข้อมูลบัญชี: พบบัญชี+แผนซ้ำในไฟล์ ตัดออก ${duplicateCount} แถว (ใช้ข้อมูลแถวล่าสุดของแต่ละบัญชี+แผน) by=${adminUsername}`);
    }

    const skipCbsNote = result.skipCbs > 0 ? `, skip(send to CBS success) ${result.skipCbs} แถว` : '';
    const skipExpiredNote = result.skipExpired > 0 ? `, skip(not expired) ${result.skipExpired} แถว` : '';
    const dupNote = duplicateCount > 0 ? `, ตัดแถวซ้ำในไฟล์ ${duplicateCount} แถว (ใช้ข้อมูลแถวล่าสุด)` : '';
    return {
        success: true,
        message: `นำเข้าข้อมูลบัญชีสำเร็จ (ปิดใช้งานข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว${skipCbsNote}${skipExpiredNote}${dupNote})`,
        data: { ...result, planSummary, errors, warnings, duplicateCount }
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
