const adminUserManageService = require('../../services/admin/adminUserManageService');
const { adminSystemLogService } = require('../../services/util/systemLog/adminSystemLogService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'adminUserManageController' });

const listAdminUsers = async (req, res) => {
    try {
        const { keyword, role, status } = req.query;
        const result = await adminUserManageService.listAdminUsers({ keyword, role, status });
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`List admin users error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

const addAdminUser = async (req, res) => {
    try {
        const { username, displayName, email, role } = req.body;
        const actorUsername = req.admin?.username || 'DRRS';
        const result = await adminUserManageService.addAdminUser({ username, displayName, email, role }, actorUsername);

        // audit log — ไม่มีข้อมูลอ่อนไหว (แค่ username/displayName/role ของ admin ภายในองค์กร)
        await adminSystemLogService({
            step: 'addAdminUser',
            controller: 'adminUserManageController',
            payload: { username, displayName, role },
            responseStatus: result.success ? 'SUCCESS' : 'FAILED',
            response: { message: result.message },
            createdBy: actorUsername,
        });

        if (!result.success) {
            return res.status(result.statusCode || 400).json(result);
        }
        return res.status(201).json(result);
    } catch (error) {
        logger.error(`Add admin user error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

const updateAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, status } = req.body;
        const actorUsername = req.admin?.username || 'DRRS';
        const result = await adminUserManageService.updateAdminUser(parseInt(id, 10), { role, status }, actorUsername);

        await adminSystemLogService({
            step: 'updateAdminUser',
            controller: 'adminUserManageController',
            payload: { id, role, status },
            responseStatus: result.success ? 'SUCCESS' : 'FAILED',
            response: { message: result.message },
            createdBy: actorUsername,
        });

        if (!result.success) {
            return res.status(result.statusCode || 400).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        logger.error(`Update admin user error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    }
};

module.exports = { listAdminUsers, addAdminUser, updateAdminUser };
