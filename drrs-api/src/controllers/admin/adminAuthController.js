const { loginWithAD } = require('../../services/admin/adminAuthService');
const { adminSystemLogService } = require('../../services/util/systemLog/adminSystemLogService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'adminAuthController' });

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await loginWithAD(username, password);

        // audit log ไว้ที่ tbl_admin_system_log (แยกจาก log ลูกค้า) — log แค่ username ไม่ log password เด็ดขาด
        await adminSystemLogService({
            step: 'adminLogin',
            controller: 'adminAuthController',
            payload: { username },
            responseStatus: result.success ? 'SUCCESS' : 'FAILED',
            response: { message: result.message },
            createdBy: username || 'DRRS',
        });

        if (!result.success) {
            return res.status(result.statusCode || 401).json({ success: false, message: result.message });
        }
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`Admin login error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = { login };
