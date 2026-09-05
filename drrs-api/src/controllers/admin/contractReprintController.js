const contractReprintService = require('../../services/admin/contractReprintService');
const { adminSystemLogService } = require('../../services/util/systemLog/adminSystemLogService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractReprintController' });

// ปิดบังเลขบัตรประชาชนก่อนเก็บลง audit log — ห้าม log ข้อมูลอ่อนไหวแบบเต็มๆ (ตามหลักการของระบบ)
// เก็บไว้แค่ 4 ตัวหลังพอให้ตรวจสอบย้อนหลังได้ว่าค้นหาใคร โดยไม่เปิดเผยเลขบัตรเต็ม
const maskCitizenId = (citizenId) => {
    if (!citizenId) return citizenId;
    const str = String(citizenId);
    return str.length <= 4 ? '****' : `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
};

const searchContracts = async (req, res) => {
    try {
        const { citizenId, accountNo, firstName, lastName } = req.query;
        const result = await contractReprintService.searchContracts({ citizenId, accountNo, firstName, lastName });

        await adminSystemLogService({
            step: 'searchContracts',
            controller: 'contractReprintController',
            payload: { citizenId: maskCitizenId(citizenId), accountNo, firstName, lastName },
            responseStatus: result.success ? 'SUCCESS' : 'FAILED',
            response: { message: result.message, resultCount: result.data?.length ?? 0 },
            createdBy: req.admin?.username || 'DRRS',
        });

        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`Search contracts error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

const downloadContract = async (req, res) => {
    try {
        const { contractFileId } = req.params;
        const result = await contractReprintService.getContractFile(parseInt(contractFileId, 10));

        await adminSystemLogService({
            step: 'downloadContract',
            controller: 'contractReprintController',
            payload: { contractFileId },
            responseStatus: result.success ? 'SUCCESS' : 'FAILED',
            response: { message: result.message, fileName: result.data?.fileName },
            createdBy: req.admin?.username || 'DRRS',
        });

        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`Download contract error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = { searchContracts, downloadContract };
