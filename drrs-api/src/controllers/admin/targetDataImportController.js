const targetDataImportService = require('../../services/admin/targetDataImportService');
const { adminSystemLogService } = require('../../services/util/systemLog/adminSystemLogService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'targetDataImportController' });

/**
 * รับไฟล์ .csv 3 ไฟล์ (customer, account, plan) — pipe-delimited, Windows-874, ไม่มี header
 * ต้อง import ตามลำดับเสมอ (ลูกค้า -> บัญชี -> แผน) เพราะไฟล์บัญชีต้องอ้าง cifNo ที่มีอยู่แล้วจากไฟล์ลูกค้า
 * ไฟล์แผนไม่ผูกกับ 2 ไฟล์แรก จึง import เป็นอิสระได้
 */
const importTargetData = async (req, res) => {
    try {
        const files = req.files || {};
        const adminUsername = req.admin?.username || 'DRRS';

        if (!files.customer && !files.account && !files.plan) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์' });
        }

        const results = {};

        // ลูกค้าต้อง import ก่อนบัญชีเสมอ (บัญชีอ้าง citizenId จากลูกค้า)
        if (files.customer?.[0]) {
            try {
                results.customer = await targetDataImportService.importCustomer(files.customer[0].buffer, adminUsername);
            } catch (error) {
                logger.error(`Import customer failed: ${error.message}`);
                results.customer = { success: false, message: `นำเข้าข้อมูลลูกค้าล้มเหลว: ${error.message}` };
            }
        }

        if (files.account?.[0]) {
            try {
                results.account = await targetDataImportService.importAccount(files.account[0].buffer, adminUsername);
            } catch (error) {
                logger.error(`Import account failed: ${error.message}`);
                results.account = { success: false, message: `นำเข้าข้อมูลบัญชีล้มเหลว: ${error.message}` };
            }
        }

        if (files.plan?.[0]) {
            try {
                results.plan = await targetDataImportService.importPlan(files.plan[0].buffer, adminUsername);
            } catch (error) {
                logger.error(`Import plan failed: ${error.message}`);
                results.plan = { success: false, message: `นำเข้าข้อมูลแผนล้มเหลว: ${error.message}` };
            }
        }

        const overallSuccess = Object.values(results).every((r) => r.success);

        // audit log ไว้ที่ tbl_admin_system_log (แยกจาก log ลูกค้า) — เก็บชื่อไฟล์ที่ upload มา
        await adminSystemLogService({
            step: 'importTargetData',
            controller: 'targetDataImportController',
            payload: {
                customer: files.customer?.[0]?.originalname,
                account: files.account?.[0]?.originalname,
                plan: files.plan?.[0]?.originalname,
            },
            responseStatus: overallSuccess ? 'SUCCESS' : 'PARTIAL_FAILED',
            response: results,
            createdBy: adminUsername,
        });

        return res.status(overallSuccess ? 200 : 207).json({ success: overallSuccess, data: results });
    } catch (error) {
        logger.error(`Target data import error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = { importTargetData };
