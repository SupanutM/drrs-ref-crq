const pdfService = require('../../services/condition/downloadConditionPdfService');
const baseLogger = require('../../utils/logger');
const createStepService = require('../../services/util/systemLog/createStepService');
const logger = baseLogger.child({ context: 'pdfController' });

const generatePdfController = async (req, res) => {
    try {
        logger.info(`req: ${JSON.stringify(req.body)}`)
        const base64Pdf = await pdfService.generateInvoiceBase64(req.body);

        const accountNo = req.body.accountNo || (Array.isArray(req.body.items) && req.body.items[0]?.accountNo);
        if (accountNo) {
            logger.info(`[Step Log] อัปเดต step stepSendToCbs: "1" สำหรับ AccountNo: ${accountNo}`);
            await createStepService.updateStepService(accountNo, { stepSendToCbs: "1" }, 'stepSendToCbs');
        }

        res.json({
            success: true,
            base64: base64Pdf,
            fileName: `condition_${req.body.conditionYear || ''}.pdf`
        });

    } catch (error) {
        logger.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    generatePdfController
};