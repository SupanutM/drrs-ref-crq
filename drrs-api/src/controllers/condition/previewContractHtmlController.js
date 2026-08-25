const contractPdfService = require('../../services/condition/previewContractHtmlService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'previewContractHtmlController' });
const { augmentAccountsWithDbData, augmentCustomerInfoWithDbData } = require('../../utils/contractHelper');
const { ownsAccount } = require('../../middleware/authMiddleware');

const previewContractHtmlController = async (req, res) => {
    try {
        const { selectedAccounts } = req.body;
        // cusTargetId มาจาก session token (req.auth) ไม่เชื่อค่าจาก body (กัน IDOR)
        const cusTargetId = req.auth?.cusTargetId;
        if (!cusTargetId) {
            return res.status(401).json({ success: false, message: 'unauthorized' });
        }

        for (const acc of (selectedAccounts || [])) {
            if (!ownsAccount(req, acc.accountNo)) {
                logger.warn(`[IDOR Block] accountNo ${acc.accountNo} ไม่ได้เป็นของ session นี้`);
                return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการกับบัญชีนี้' });
            }
        }

        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);

        // Fetch customer data from DB directly instead of trusting frontend payload
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(cusTargetId, selectedAccounts?.[0]?.accountNo);

        const htmlContent = await contractPdfService.previewContractHtml(augmentedCustomerInfo, augmentedAccounts);

        res.set('Content-Type', 'text/html');
        res.send(htmlContent);
    } catch (error) {
        logger.error(`Error previewing contract HTML: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to preview contract HTML',
            error: error.message
        });
    }
};

module.exports = {
    previewContractHtmlController
};
