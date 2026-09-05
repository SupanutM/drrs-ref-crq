const ExcelJS = require('exceljs');
const iconv = require('iconv-lite');
const { AppDataSource } = require('../../config/database');
const tblMtProvince = require('../../entities/tblMtProvince');
const tblMtDistrict = require('../../entities/tblMtDistrict');
const tblMtSubDistrict = require('../../entities/tblMtSubDistrict');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'masterDataImportService' });

/**
 * อ่านไฟล์ xlsx จาก buffer (sheet แรกเท่านั้น) -> คืน { headers, rows }
 * แถวที่ 1 ต้องเป็น header — ชื่อคอลัมน์จะถูก normalize เป็นตัวพิมพ์ใหญ่ + trim
 * เพื่อจับคู่แบบไม่สนตัวพิมพ์เล็ก/ใหญ่ (กันเคส admin พิมพ์ header เพี้ยนเล็กน้อย)
 */
const parseXlsxSheet = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { headers: [], rows: [] };

    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').trim().toUpperCase();
    });

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // ข้าม header
        const obj = {};
        let hasValue = false;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const key = headers[colNumber];
            if (!key) return;
            const raw = cell.value;
            const value = raw != null && typeof raw === 'object' && 'text' in raw
                ? String(raw.text).trim()  // เซลล์ rich-text ของ Excel
                : (raw != null ? String(raw).trim() : '');
            if (value !== '') hasValue = true;
            obj[key] = value;
        });
        if (hasValue) rows.push({ rowNumber, data: obj });
    });

    return { headers, rows };
};

/**
 * อ่านไฟล์ .csv จาก buffer (ไม่มี header, ตำแหน่งคอลัมน์คงที่ตามไฟล์จริงจากทีมข้อมูล)
 * ไฟล์เป็น encoding Windows-874 (TIS-620) — แปลงเป็น UTF-8 ก่อน parse เสมอ
 * คืน rows แบบ array ของ array ต่อแถว (ตำแหน่งคอลัมน์ index 0,1,2,...) ไม่ใช่ object ตาม header
 * เพราะไฟล์จริงไม่มี header ให้ map ชื่อ
 */
const parseCsvFixedColumns = (buffer) => {
    // แปลง Windows-874 (รหัสหน้า TIS-620 ที่ใช้กันในไฟล์ราชการไทยรุ่นเก่า) -> UTF-8
    const text = iconv.decode(buffer, 'windows-874');

    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    const rows = lines.map((line, index) => ({
        rowNumber: index + 1, // ไม่มี header จึงเริ่มนับแถวข้อมูลจริงที่ 1 (ไม่ใช่ header+1 แบบ xlsx)
        columns: line.split(',').map((col) => col.trim()),
    }));

    return { rows };
};

/**
 * ตรวจสอบนามสกุลไฟล์จาก originalname เพื่อเลือกวิธี parse ที่ถูกต้อง
 */
const isCsvFile = (originalname) => /\.csv$/i.test(originalname || '');

const validateHeaders = (headers, required) => required.filter((col) => !headers.includes(col));

/**
 * แทนที่ข้อมูลทั้งตาราง (province/district/sub-district) ด้วยไฟล์ที่ import ใหม่:
 *   1. ลบแถวเดิมทั้งหมดในตารางนั้นจริง (hard delete) — ไม่เหลือแถวประวัติให้ตรวจสอบย้อนหลัง
 *   2. Insert แถวจากไฟล์ที่ import เป็นแถวใหม่ทั้งหมด (status='1')
 * ทำในทรานแซกชันเดียว กันเคสลบสำเร็จแต่ insert ใหม่พังแล้วข้อมูลหายเปล่า
 *
 * หมายเหตุ: ตาราง master เหล่านี้ไม่มี primary key/unique constraint จริงใน DB (แม้ entity จะ
 * ประกาศ primary:true ไว้ก็ตาม) จึง insert แถวใหม่ได้โดยไม่ชน constraint
 */
const replaceAllRows = async (manager, EntitySchemaRef, mappedRows, adminUsername) => {
    // DB server ตั้ง encoding เป็น WIN874 (ไม่ใช่ UTF8) แต่ connection ของ backend ไม่ได้ระบุ
    // client_encoding ไว้ ทำให้ข้อความไทย (UTF-8 จาก Node.js) ถูกเก็บผิดเพี้ยนตอน insert/update
    // ใช้ SET LOCAL (ผูกกับ transaction นี้เท่านั้น ไม่กระทบ connection อื่นใน pool เพราะค่าจะ
    // รีเซ็ตกลับอัตโนมัติตอน COMMIT/ROLLBACK) บังคับให้ session นี้สื่อสารด้วย UTF8 ตรงกับที่
    // แอปส่งมาจริง แก้ปัญหาตัวหนังสือไทยเพี้ยนเฉพาะจุด import นี้ โดยไม่แตะ config การเชื่อมต่อ DB
    // ของทั้งระบบ (ซึ่งเป็นการเปลี่ยนแปลงที่กระทบทุกฟีเจอร์ ต้องขอ confirm แยกก่อนทำ)
    await manager.query("SET LOCAL client_encoding TO 'UTF8'");

    const repo = manager.getRepository(EntitySchemaRef);

    // ลบแถวเดิมทั้งหมดในตารางจริง (hard delete) ตามที่ตกลง — ไม่ soft-delete แล้ว
    // ใช้ query ตรงแทน repo.delete({}) เพราะ TypeORM ปฏิเสธ criteria ว่างเปล่า
    // (ขึ้น error "Empty criteria(s) are not allowed for the delete method")
    const tableName = repo.metadata.tableName;
    const beforeCountResult = await manager.query(`SELECT COUNT(*)::int AS count FROM drrs."${tableName}"`);
    const deleted = beforeCountResult[0]?.count ?? 0;
    await manager.query(`DELETE FROM drrs."${tableName}"`);

    // ตั้ง createdDate เองตรงๆ — ตารางนี้ใช้ composite primary key (ไม่มี auto-generated id)
    // ทำให้ TypeORM ไม่ apply ค่า default ของ createDate:true ให้อัตโนมัติตอน insert
    // (ต่างจาก entity ที่มี auto-increment id ซึ่งกลไกนี้ทำงานถูกต้อง) ถ้าไม่ตั้งเอง
    // จะชน NOT NULL constraint ของ created_date
    const newRows = mappedRows.map((row) => ({
        ...row,
        status: '1',
        createdBy: adminUsername,
        createdDate: new Date(),
    }));

    // ใช้ repo.insert() (ไม่ใช่ save()) — insert() สั่ง INSERT ตรงๆเสมอ ไม่ต้องพึ่งการเช็คแถวเดิม
    // เพราะลบทั้งตารางไปแล้วข้างบน (ไม่มีแถวชน key ให้ต้องกังวล)
    //
    // ต้องแบ่งเป็น batch (chunk) ก่อน insert — PostgreSQL จำกัด parameter ของ query เดียวไว้ที่
    // 65535 ตัว ไฟล์ตำบลจริงมีหลายพันแถว x 8 คอลัมน์ต่อแถว (lang, provinceCode, districtCode,
    // subDistrictCode, subDistrictName, status, createdBy, createdDate) พอเกิน 65535/8 ≈ 8,191
    // แถว จะชน error "bind message has N parameter formats but 0 parameters" (ตัวเลขเพี้ยนเพราะ
    // parameter count overflow ของ wire protocol) ถ้ายิง insert() เป็นก้อนเดียวทั้งหมด
    const BATCH_SIZE = 1000; // เผื่อ margin ไว้มาก (1000 แถว x 8 คอลัมน์ = 8,000 params ต่อ batch)
    for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const chunk = newRows.slice(i, i + BATCH_SIZE);
        await repo.insert(chunk);
    }

    return { deleted, inserted: newRows.length };
};

/**
 * Import จังหวัด
 *   - .xlsx (มี header): คอลัมน์ที่ต้องมี LANG, PROVINCE_CODE, PROVINCE_NAME (จับคู่ตามชื่อ header)
 *   - .csv (ไม่มี header, Windows-874): ตำแหน่งคอลัมน์คงที่ [LANG, PROVINCE_CODE, PROVINCE_NAME]
 *     ตามไฟล์จริงจากทีมข้อมูล เช่น "TH,10,กรุงเทพมหานคร" — import ทุกแถวรวมทั้งแถวรหัสประเทศ (lang != TH)
 */
const importProvince = async (buffer, adminUsername, originalname) => {
    const errors = [];
    const mappedRows = [];

    if (isCsvFile(originalname)) {
        const { rows } = parseCsvFixedColumns(buffer);
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์จังหวัด' };
        }
        rows.forEach(({ rowNumber, columns }) => {
            const [lang, provinceCode, provinceName] = columns;
            if (!lang || !provinceCode || !provinceName) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 3 คอลัมน์: LANG, PROVINCE_CODE, PROVINCE_NAME)`);
                return;
            }
            mappedRows.push({ lang, provinceCode, provinceName });
        });
    } else {
        const { headers, rows } = await parseXlsxSheet(buffer);
        const required = ['LANG', 'PROVINCE_CODE', 'PROVINCE_NAME'];
        const missing = validateHeaders(headers, required);
        if (missing.length > 0) {
            return { success: false, message: `หัวคอลัมน์ไม่ครบ (จังหวัด): ขาด ${missing.join(', ')}` };
        }
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์จังหวัด' };
        }
        rows.forEach(({ rowNumber, data }) => {
            if (!data.LANG || !data.PROVINCE_CODE || !data.PROVINCE_NAME) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (LANG/PROVINCE_CODE/PROVINCE_NAME)`);
                return;
            }
            mappedRows.push({
                lang: data.LANG,
                provinceCode: data.PROVINCE_CODE,
                provinceName: data.PROVINCE_NAME,
            });
        });
    }

    // กันเคสทุกแถวไม่ผ่าน validation (ข้อมูลไม่ครบหมดทั้งไฟล์) — ห้าม soft-delete ข้อมูลเดิมทิ้ง
    // โดยไม่มีข้อมูลใหม่มาแทนที่ ไม่งั้นจะเหลือ 0 แถวที่ status='1' ทั้งตาราง
    if (mappedRows.length === 0) {
        return {
            success: false,
            message: 'ไม่มีแถวข้อมูลที่ถูกต้องในไฟล์เลย (ทุกแถวข้อมูลไม่ครบ) ยกเลิกการนำเข้า ข้อมูลเดิมไม่ถูกแก้ไข',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    const result = await AppDataSource.transaction((manager) =>
        replaceAllRows(manager, tblMtProvince, mappedRows, adminUsername)
    );

    logger.info(`Import จังหวัด: ลบเดิม=${result.deleted} เพิ่มใหม่=${result.inserted} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าจังหวัดสำเร็จ (ลบข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว)`,
        data: { ...result, errors }
    };
};

/**
 * ตรวจสอบว่าแถวข้อมูลลูก (อำเภอ/ตำบล) มี "แม่" (จังหวัด/อำเภอ) อยู่ในระบบแล้วหรือยัง
 * บังคับลำดับการนำเข้า: จังหวัด -> อำเภอ -> ตำบล เท่านั้น
 * ถ้าแม่ยังไม่มี — ตัดแถวนั้นออกจากการ import (ไม่ insert/update) พร้อม log error ไว้ให้ admin เห็น
 *
 * @param {object[]} rows แถวที่ map แล้ว (มีครบทุก field ที่จำเป็นแล้ว)
 * @param {Set<string>} parentKeySet ชุด key ของแม่ที่มีอยู่จริงในระบบ (สร้างจาก buildKey ของแม่)
 * @param {(row: object) => string} buildChildParentKey ฟังก์ชันแปลงแถวลูกเป็น key ของแม่ที่ต้องอ้างอิง
 * @param {string} parentLabel ชื่อเรียกแม่ (ใช้ขึ้น error message) เช่น "จังหวัด"
 */
const filterRowsByParentExists = (rows, parentKeySet, buildChildParentKey, parentLabel) => {
    const validRows = [];
    const errors = [];
    rows.forEach((row) => {
        const parentKey = buildChildParentKey(row);
        if (!parentKeySet.has(parentKey)) {
            errors.push(`${parentLabel} (${parentKey.replace(/\|/g, '/')}) ยังไม่มีในระบบ — กรุณานำเข้า${parentLabel}ก่อน`);
            return;
        }
        validRows.push(row);
    });
    return { validRows, errors };
};

/**
 * Import อำเภอ
 *   - .xlsx (มี header): คอลัมน์ที่ต้องมี LANG, PROVINCE_CODE, DISTRICT_CODE, DISTRICT_NAME
 *   - .csv (ไม่มี header, Windows-874): ตำแหน่งคอลัมน์คงที่
 *     [LANG, PROVINCE_CODE, DISTRICT_CODE, DISTRICT_NAME] เช่น "TH,10,10,เขตธนบุรี"
 * บังคับลำดับ: ต้องมีจังหวัดที่อ้างอิงอยู่ในระบบแล้ว (นำเข้าจังหวัดก่อน) ไม่งั้นแถวนั้นจะถูกข้าม
 */
const importDistrict = async (buffer, adminUsername, originalname) => {
    const errors = [];
    const mappedRows = [];

    if (isCsvFile(originalname)) {
        const { rows } = parseCsvFixedColumns(buffer);
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์อำเภอ' };
        }
        rows.forEach(({ rowNumber, columns }) => {
            const [lang, provinceCode, districtCode, districtName] = columns;
            if (!lang || !provinceCode || !districtCode || !districtName) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 4 คอลัมน์: LANG, PROVINCE_CODE, DISTRICT_CODE, DISTRICT_NAME)`);
                return;
            }
            mappedRows.push({ lang, provinceCode, districtCode, districtName });
        });
    } else {
        const { headers, rows } = await parseXlsxSheet(buffer);
        const required = ['LANG', 'PROVINCE_CODE', 'DISTRICT_CODE', 'DISTRICT_NAME'];
        const missing = validateHeaders(headers, required);
        if (missing.length > 0) {
            return { success: false, message: `หัวคอลัมน์ไม่ครบ (อำเภอ): ขาด ${missing.join(', ')}` };
        }
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์อำเภอ' };
        }
        rows.forEach(({ rowNumber, data }) => {
            if (!data.LANG || !data.PROVINCE_CODE || !data.DISTRICT_CODE || !data.DISTRICT_NAME) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (LANG/PROVINCE_CODE/DISTRICT_CODE/DISTRICT_NAME)`);
                return;
            }
            mappedRows.push({
                lang: data.LANG,
                provinceCode: data.PROVINCE_CODE,
                districtCode: data.DISTRICT_CODE,
                districtName: data.DISTRICT_NAME,
            });
        });
    }

    // บังคับลำดับ: จังหวัดที่อ้างอิงต้องมีอยู่ในระบบ (status='1') ก่อนเสมอ
    const provinceRepo = AppDataSource.getRepository(tblMtProvince);
    const activeProvinces = await provinceRepo.find({ where: { status: '1' } });
    const provinceKeySet = new Set(activeProvinces.map((p) => `${p.lang}|${p.provinceCode}`));

    const { validRows, errors: parentErrors } = filterRowsByParentExists(
        mappedRows,
        provinceKeySet,
        (row) => `${row.lang}|${row.provinceCode}`,
        'จังหวัด'
    );
    errors.push(...parentErrors);

    if (validRows.length === 0) {
        return {
            success: false,
            message: 'ไม่สามารถนำเข้าอำเภอได้ เนื่องจากยังไม่มีข้อมูลจังหวัดที่อ้างอิงในระบบ ' +
                'กรุณานำเข้าจังหวัดก่อน (ต้องนำเข้าตามลำดับ: จังหวัด -> อำเภอ -> ตำบล)',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    const result = await AppDataSource.transaction((manager) =>
        replaceAllRows(manager, tblMtDistrict, validRows, adminUsername)
    );

    logger.info(`Import อำเภอ: ลบเดิม=${result.deleted} เพิ่มใหม่=${result.inserted} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าอำเภอสำเร็จ (ลบข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว)`,
        data: { ...result, errors }
    };
};

/**
 * Import ตำบล
 *   - .xlsx (มี header): คอลัมน์ที่ต้องมี LANG, PROVINCE_CODE, DISTRICT_CODE, SUB_DISTRICT_CODE, SUB_DISTRICT_NAME
 *   - .csv (ไม่มี header, Windows-874): ตำแหน่งคอลัมน์คงที่
 *     [LANG, PROVINCE_CODE, DISTRICT_CODE, SUB_DISTRICT_CODE, SUB_DISTRICT_NAME] เช่น "TH,10,10,01,วัดกัลยาณ์"
 * บังคับลำดับ: ต้องมีอำเภอที่อ้างอิงอยู่ในระบบแล้ว (นำเข้าอำเภอก่อน) ไม่งั้นแถวนั้นจะถูกข้าม
 */
const importSubDistrict = async (buffer, adminUsername, originalname) => {
    const errors = [];
    const mappedRows = [];

    if (isCsvFile(originalname)) {
        const { rows } = parseCsvFixedColumns(buffer);
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์ตำบล' };
        }
        rows.forEach(({ rowNumber, columns }) => {
            const [lang, provinceCode, districtCode, subDistrictCode, subDistrictName] = columns;
            if (!lang || !provinceCode || !districtCode || !subDistrictCode || !subDistrictName) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ (ต้องมี 5 คอลัมน์)`);
                return;
            }
            mappedRows.push({ lang, provinceCode, districtCode, subDistrictCode, subDistrictName });
        });
    } else {
        const { headers, rows } = await parseXlsxSheet(buffer);
        const required = ['LANG', 'PROVINCE_CODE', 'DISTRICT_CODE', 'SUB_DISTRICT_CODE', 'SUB_DISTRICT_NAME'];
        const missing = validateHeaders(headers, required);
        if (missing.length > 0) {
            return { success: false, message: `หัวคอลัมน์ไม่ครบ (ตำบล): ขาด ${missing.join(', ')}` };
        }
        if (rows.length === 0) {
            return { success: false, message: 'ไม่พบข้อมูลในไฟล์ตำบล' };
        }
        rows.forEach(({ rowNumber, data }) => {
            if (!data.LANG || !data.PROVINCE_CODE || !data.DISTRICT_CODE || !data.SUB_DISTRICT_CODE || !data.SUB_DISTRICT_NAME) {
                errors.push(`แถวที่ ${rowNumber}: ข้อมูลไม่ครบ`);
                return;
            }
            mappedRows.push({
                lang: data.LANG,
                provinceCode: data.PROVINCE_CODE,
                districtCode: data.DISTRICT_CODE,
                subDistrictCode: data.SUB_DISTRICT_CODE,
                subDistrictName: data.SUB_DISTRICT_NAME,
            });
        });
    }

    // บังคับลำดับ: อำเภอที่อ้างอิงต้องมีอยู่ในระบบ (status='1') ก่อนเสมอ
    const districtRepo = AppDataSource.getRepository(tblMtDistrict);
    const activeDistricts = await districtRepo.find({ where: { status: '1' } });
    const districtKeySet = new Set(activeDistricts.map((d) => `${d.lang}|${d.provinceCode}|${d.districtCode}`));

    const { validRows, errors: parentErrors } = filterRowsByParentExists(
        mappedRows,
        districtKeySet,
        (row) => `${row.lang}|${row.provinceCode}|${row.districtCode}`,
        'อำเภอ'
    );
    errors.push(...parentErrors);

    if (validRows.length === 0) {
        return {
            success: false,
            message: 'ไม่สามารถนำเข้าตำบลได้ เนื่องจากยังไม่มีข้อมูลอำเภอที่อ้างอิงในระบบ ' +
                'กรุณานำเข้าอำเภอก่อน (ต้องนำเข้าตามลำดับ: จังหวัด -> อำเภอ -> ตำบล)',
            data: { deleted: 0, inserted: 0, errors }
        };
    }

    const result = await AppDataSource.transaction((manager) =>
        replaceAllRows(manager, tblMtSubDistrict, validRows, adminUsername)
    );

    logger.info(`Import ตำบล: ลบเดิม=${result.deleted} เพิ่มใหม่=${result.inserted} error=${errors.length}`);
    return {
        success: true,
        message: `นำเข้าตำบลสำเร็จ (ลบข้อมูลเดิม ${result.deleted} แถว, เพิ่มใหม่ ${result.inserted} แถว)`,
        data: { ...result, errors }
    };
};

module.exports = {
    importProvince,
    importDistrict,
    importSubDistrict,
};
