const { In, ILike } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblContractFile = require('../../entities/tblContractFile');
const tblContractFileAccount = require('../../entities/tblContractFileAccount');
const tblCusTarget = require('../../entities/tblCusTarget');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractReprintService' });

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
const searchContracts = async ({ citizenId, accountNo, firstName, lastName }) => {
    if (!citizenId && !accountNo && !firstName && !lastName) {
        return { success: false, message: 'กรุณาระบุเลขบัตรประชาชน เลขบัญชี ชื่อ หรือนามสกุล อย่างน้อย 1 อย่าง' };
    }

    const fileRepo = AppDataSource.getRepository(tblContractFile);
    const accRepo = AppDataSource.getRepository(tblContractFileAccount);

    let fileWhere = {};

    if (citizenId || firstName || lastName) {
        const cusRepo = AppDataSource.getRepository(tblCusTarget);
        const customerWhere = {};
        if (citizenId) customerWhere.citizenId = citizenId;
        if (firstName) customerWhere.firstName = ILike(`%${firstName}%`);
        if (lastName) customerWhere.lastName = ILike(`%${lastName}%`);

        const customers = await cusRepo.find({ where: customerWhere });
        if (customers.length === 0) {
            return { success: true, message: 'ไม่พบข้อมูลลูกค้าตามเงื่อนไขที่ระบุ', data: [] };
        }
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

    const files = await fileRepo.find({
        where: fileWhere,
        order: { createdDate: 'DESC' }
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
        });
    });

    // ค้นด้วยชื่อ/นามสกุลอาจตรงกับลูกค้าหลายคน — ดึงชื่อลูกค้ามาแสดงคู่กับสัญญาแต่ละใบ
    // เพื่อให้ admin แยกได้ว่าสัญญานี้เป็นของใคร
    const cusTargetIds = [...new Set(files.map((f) => f.cusTargetId))];
    const cusRepo = AppDataSource.getRepository(tblCusTarget);
    const customersById = {};
    if (cusTargetIds.length > 0) {
        const customers = await cusRepo.find({ where: { id: In(cusTargetIds) } });
        customers.forEach((c) => { customersById[c.id] = c; });
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

    return { success: true, message: 'ค้นหาสำเร็จ', data };
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
