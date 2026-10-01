const { In, ILike } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblContractFile = require('../../entities/tblContractFile');
const tblContractFileAccount = require('../../entities/tblContractFileAccount');
const tblCusTarget = require('../../entities/tblCusTarget');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractReprintService' });

/**
 * จำนวนลูกค้าสูงสุดที่ยอมดึงต่อการค้นหา 1 ครั้ง — กัน 2 เรื่อง:
 *   1) In([...]) ยาวเกินลิมิต bind parameter ของ Postgres (65535) แล้ว query พังเป็น 500
 *   2) payload บวมจนหน้าเว็บช้า (หน้า reprint แบ่งหน้าฝั่ง frontend ไม่มี server-side paging)
 * ถ้าชนลิมิตจะไม่ตัดผลเงียบๆ แต่บอก admin ให้ระบุเงื่อนไขแคบลง (ดีกว่าโชว์ผลไม่ครบแบบไม่รู้ตัว)
 */
const MAX_CUSTOMER_MATCH = 500;

/** จำนวนสัญญาสูงสุดที่คืนต่อการค้นหา 1 ครั้ง — ด้วยเหตุผลเดียวกับ MAX_CUSTOMER_MATCH */
const MAX_FILE_RESULT = 500;

/** ตัดช่องว่างหัว-ท้าย และกันค่า null/undefined — backend ต้อง trim เองด้วย ไม่พึ่งหน้าเว็บ (API เรียกตรงได้) */
const clean = (value) => (value == null ? '' : String(value).trim());

/**
 * escape อักขระ wildcard ของ ILIKE (% _ \) ก่อนนำค่าที่ admin พิมพ์ไปต่อใน pattern
 * ไม่ใช่เรื่อง SQL injection (TypeORM ส่งเป็น bind parameter อยู่แล้ว) แต่ถ้าไม่ escape
 * admin พิมพ์ "%" ตัวเดียวจะกลายเป็น ILIKE '%%%' = ตรงกับลูกค้าทุกคนในตาราง
 */
const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** เงื่อนไขค้นแบบ partial ไม่สนตัวพิมพ์เล็ก-ใหญ่ (escape wildcard แล้ว) */
const partialMatch = (value) => ILike(`%${escapeLike(value)}%`);

/**
 * บัญชีใน tbl_contract_file_account ถูกบันทึกไว้ทั้งบัญชีที่ CBS รับ (cbs_status = "SUCCESS")
 * และบัญชีที่ CBS ปฏิเสธ (REJECT / NOT_FOUND / ERROR) โดยเจตนา เพื่อให้ตรวจย้อนหลังได้ว่า
 * รอบนั้นลูกค้ายื่นบัญชีอะไรมาบ้าง — ดู downloadAndEmailContractPdfController.js ที่ส่ง
 * accounts: [...successAccounts, ...rejectedAccountsForDb] เข้า saveContractFileService
 *
 * แต่ไฟล์ PDF สร้างจาก successAccounts เท่านั้น ("บัญชีที่ CBS ปฏิเสธจะไม่ถูกใส่ในสัญญา")
 * ถ้าไม่ส่งสถานะนี้ออกไป admin จะค้นเลขบัญชีที่ถูกปฏิเสธแล้วเจอสัญญา กดดาวน์โหลด
 * แต่ในไฟล์ไม่มีบัญชีนั้น — เข้าใจผิดได้ง่ายและเป็นเรื่องเงิน จึงต้องแยกให้เห็นชัด
 *
 * คืน null (ไม่ใช่ false) เมื่อ cbs_status ว่าง = ไม่มีข้อมูล ไม่ตัดสินแทนว่าอยู่/ไม่อยู่ในสัญญา
 */
const resolveIsInContract = (cbsStatus) => {
    const status = clean(cbsStatus);
    if (!status) return null;
    return status.toUpperCase() === 'SUCCESS';
};

/**
 * ค้นหาสัญญาที่เคยสร้างไว้ สำหรับ reprint — ค้นได้หลายทาง (เลือกอย่างใดอย่างหนึ่ง หรือรวมกันก็ได้):
 *   - citizenId: เลขบัตรประชาชนลูกค้า (ตรงเป๊ะ)
 *   - firstName / lastName: ชื่อ/นามสกุลลูกค้า (ค้นแบบ partial match ไม่สนตัวพิมพ์เล็ก-ใหญ่)
 *   - accountNo: เลขบัญชี (ค้นตรงที่ tbl_contract_file_account ก่อนเพื่อได้ contractFileId)
 * citizenId/firstName/lastName ค้นรวมกันที่ tbl_cus_target ก่อนเพื่อได้รายชื่อ cusTargetId
 * (ถ้าระบุมาหลายเงื่อนไข ต้องตรงทุกเงื่อนไขที่ระบุ — AND กัน)
 * คืนรายการสัญญาแบบสรุป (ไม่รวม base64Content เพื่อไม่ให้ payload หนักเกินจำเป็น)
 * เรียงจากล่าสุดไปเก่าสุด — ใช้ repository.find ธรรมดา (ไม่ใช้ queryBuilder) ให้ตรงกับ
 * แนวทางที่ใช้อยู่ทั้งโปรเจกต์ และเลี่ยงความเสี่ยงชื่อ alias ของ raw query
 */
const searchContracts = async (params = {}) => {
    const citizenId = clean(params.citizenId);
    const accountNo = clean(params.accountNo);
    const firstName = clean(params.firstName);
    const lastName = clean(params.lastName);

    if (!citizenId && !accountNo && !firstName && !lastName) {
        return { success: false, message: 'กรุณาระบุเลขบัตรประชาชน เลขบัญชี ชื่อ หรือนามสกุล อย่างน้อย 1 อย่าง' };
    }

    const fileRepo = AppDataSource.getRepository(tblContractFile);
    const accRepo = AppDataSource.getRepository(tblContractFileAccount);
    const cusRepo = AppDataSource.getRepository(tblCusTarget);

    const fileWhere = {};
    // เก็บลูกค้าที่ดึงมาแล้วไว้ reuse ตอนประกอบผลลัพธ์ท้ายฟังก์ชัน (ไม่ query tbl_cus_target ซ้ำรอบสอง)
    const customersById = {};

    if (citizenId || firstName || lastName) {
        const customerWhere = {};
        if (citizenId) customerWhere.citizenId = citizenId;
        if (firstName) customerWhere.firstName = partialMatch(firstName);
        if (lastName) customerWhere.lastName = partialMatch(lastName);

        // ดึงเกินลิมิต 1 แถว เพื่อแยกเคส "พอดีลิมิต" ออกจาก "เกินลิมิต" ได้
        const customers = await cusRepo.find({ where: customerWhere, take: MAX_CUSTOMER_MATCH + 1 });
        if (customers.length === 0) {
            return { success: true, message: 'ไม่พบข้อมูลลูกค้าตามเงื่อนไขที่ระบุ', data: [] };
        }
        if (customers.length > MAX_CUSTOMER_MATCH) {
            return {
                success: false,
                message: `พบลูกค้าตรงเงื่อนไขมากกว่า ${MAX_CUSTOMER_MATCH} คน กรุณาระบุเงื่อนไขให้แคบลง (เช่น ใส่นามสกุล หรือเลขบัตรประชาชน)`
            };
        }

        customers.forEach((c) => { customersById[c.id] = c; });
        fileWhere.cusTargetId = In(customers.map((c) => c.id));
    }

    if (accountNo) {
        const matchingAccounts = await accRepo.find({ where: { accountNo } });
        const contractFileIds = [...new Set(matchingAccounts.map((a) => a.contractFileId))];
        if (contractFileIds.length === 0) {
            return { success: true, message: 'ไม่พบสัญญาตามเลขบัญชีที่ระบุ', data: [] };
        }
        fileWhere.id = In(contractFileIds);
    }

    // หมายเหตุ: ไม่ใส่ option select เพื่อตัด base64Content ออก — เคยลองแล้วทำให้ query พัง 500
    // บน typeorm ตัวที่โปรเจกต์ใช้ จึงยอมดึงทุก column เหมือนเดิมก่อน (ของเดิมก็ดึงทั้งหมดอยู่แล้ว)
    // ถ้าจะตัด base64 ออกจริงต้องทำที่ entity (select: false) + ให้ getContractFile ขอ column นี้
    // เป็นกรณีพิเศษ ซึ่งเป็นงานแยก ไม่ควรเสี่ยงรวมมาในรอบนี้
    const files = await fileRepo.find({
        where: fileWhere,
        order: { createdDate: 'DESC' },
        take: MAX_FILE_RESULT
    });

    if (files.length === 0) {
        return { success: true, message: 'ไม่พบสัญญาตามเงื่อนไขที่ระบุ', data: [] };
    }

    const fileIds = files.map((f) => f.id);
    const accounts = await accRepo.find({ where: { contractFileId: In(fileIds) } });

    const accountsByFileId = {};
    accounts.forEach((acc) => {
        if (!accountsByFileId[acc.contractFileId]) accountsByFileId[acc.contractFileId] = [];
        accountsByFileId[acc.contractFileId].push({
            accountNo: acc.accountNo,
            planNo: acc.planNo,
            paymentAmount: acc.paymentAmount,
            installmentTerms: acc.installmentTerms,
            // สถานะจาก CBS Register Digitalloan ณ ตอนเซ็นสัญญา + ธงสรุปว่าบัญชีนี้อยู่ในไฟล์ PDF จริงไหม
            // (ดู resolveIsInContract — isInContract = null คือไม่มีข้อมูลสถานะ ไม่ใช่ "ไม่อยู่")
            cbsStatus: acc.cbsStatus,
            cbsDesc: acc.cbsDesc,
            isInContract: resolveIsInContract(acc.cbsStatus),
        });
    });

    // ค้นด้วยชื่อ/นามสกุลอาจตรงกับลูกค้าหลายคน — ดึงชื่อลูกค้ามาแสดงคู่กับสัญญาแต่ละใบ
    // เพื่อให้ admin แยกได้ว่าสัญญานี้เป็นของใคร
    // ดึงเฉพาะ id ที่ยังไม่มีในแมพ (เคสค้นด้วยเลขบัญชีเพียวๆ จะยังไม่มีข้อมูลลูกค้าเลย)
    const missingCusTargetIds = [...new Set(files.map((f) => f.cusTargetId))]
        .filter((id) => !customersById[id]);
    if (missingCusTargetIds.length > 0) {
        const moreCustomers = await cusRepo.find({ where: { id: In(missingCusTargetIds) } });
        moreCustomers.forEach((c) => { customersById[c.id] = c; });
    }

    const data = files.map((f) => {
        const customer = customersById[f.cusTargetId];
        return {
            contractFileId: f.id,
            cusTargetId: f.cusTargetId,
            fileName: f.fileName,
            createdDate: f.createdDate,
            customerName: customer ? `${customer.firstName} ${customer.lastName}` : null,
            accounts: accountsByFileId[f.id] || [],
        };
    });

    // ชนลิมิตพอดี = อาจมีสัญญาที่ไม่ได้คืนมา ต้องบอก admin ไม่ปล่อยให้เข้าใจว่านี่คือผลทั้งหมด
    // (ส่ง truncated เป็น flag แยก เพราะหน้าเว็บโชว์ message เฉพาะตอนไม่พบผล/ค้นไม่สำเร็จ)
    const truncated = files.length === MAX_FILE_RESULT;

    return {
        success: true,
        message: truncated
            ? `ค้นหาสำเร็จ แต่แสดงเพียง ${MAX_FILE_RESULT} รายการล่าสุด อาจมีมากกว่านี้ — กรุณาระบุเงื่อนไขให้แคบลง`
            : 'ค้นหาสำเร็จ',
        truncated,
        data
    };
};

/**
 * ดึงไฟล์สัญญา (base64) ตาม contractFileId เพื่อ reprint/ดาวน์โหลด
 */
const getContractFile = async (contractFileId) => {
    const fileRepo = AppDataSource.getRepository(tblContractFile);
    const file = await fileRepo.findOne({ where: { id: contractFileId } });

    if (!file) {
        return { success: false, message: 'ไม่พบไฟล์สัญญา' };
    }

    logger.info(`Admin reprint contract fileId=${contractFileId}`);
    return {
        success: true,
        message: 'ดึงไฟล์สำเร็จ',
        data: {
            fileName: file.fileName,
            base64Content: file.base64Content,
        }
    };
};

module.exports = {
    searchContracts,
    getContractFile,
};
