const masterDataImportService = require('../../services/admin/masterDataImportService');
const { adminSystemLogService } = require('../../services/util/systemLog/adminSystemLogService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'masterDataImportController' });

/**
 * รับไฟล์ xlsx ได้พร้อมกันสูงสุด 3 ไฟล์ (province, district, subDistrict) — field ไหนไม่ส่งมาก็ข้าม
 * แต่ละไฟล์ import อิสระกัน (ไฟล์หนึ่งพังไม่กระทบอีกไฟล์)
 */
const importMasterData = async (req, res) => {
    try {
        const files = req.files || {};
        const adminUsername = req.admin?.username || 'DRRS';

        if (!files.province && !files.district && !files.subDistrict) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์' });
        }

        const results = {};

        if (files.province?.[0]) {
            try {
                const file = files.province[0];
                results.province = await masterDataImportService.importProvince(file.buffer, adminUsername, file.originalname);
            } catch (error) {
                logger.error(`Import province failed: ${error.message}`);
                results.province = { success: false, message: `นำเข้าจังหวัดล้มเหลว: ${error.message}` };
            }
        }

        if (files.district?.[0]) {
            try {
                const file = files.district[0];
                results.district = await masterDataImportService.importDistrict(file.buffer, adminUsername, file.originalname);
            } catch (error) {
                logger.error(`Import district failed: ${error.message}`);
                results.district = { success: false, message: `นำเข้าอำเภอล้มเหลว: ${error.message}` };
            }
        }

        if (files.subDistrict?.[0]) {
            try {
                const file = files.subDistrict[0];
                results.subDistrict = await masterDataImportService.importSubDistrict(file.buffer, adminUsername, file.originalname);
            } catch (error) {
                logger.error(`Import sub-district failed: ${error.message}`);
                results.subDistrict = { success: false, message: `นำเข้าตำบลล้มเหลว: ${error.message}` };
            }
        }

        const overallSuccess = Object.values(results).every((r) => r.success);

        // audit log ไว้ที่ tbl_admin_system_log (แยกจาก log ลูกค้า) — เก็บชื่อไฟล์ที่ upload มา
        await adminSystemLogService({
            step: 'importMasterData',
            controller: 'masterDataImportController',
            payload: {
                province: files.province?.[0]?.originalname,
                district: files.district?.[0]?.originalname,
                subDistrict: files.subDistrict?.[0]?.originalname,
            },
            responseStatus: overallSuccess ? 'SUCCESS' : 'PARTIAL_FAILED',
            response: results,
            createdBy: adminUsername,
        });

        return res.status(overallSuccess ? 200 : 207).json({ success: overallSuccess, data: results });
    } catch (error) {
        logger.error(`Master data import error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = { importMasterData };
