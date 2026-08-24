const contractPdfService = require('../../services/condition/previewContractHtmlService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'previewContractHtmlController' });
const { augmentAccountsWithDbData, augmentCustomerInfoWithDbData } = require('../../utils/contractHelper');

const previewContractHtmlController = async (req, res) => {
    try {
        const { customerInfo, selectedAccounts } = req.body;
        logger.info(`Previewing contract HTML for customer: ${customerInfo?.citizenId}`);
        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);

        // Fetch customer data from DB directly instead of trusting frontend payload
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(customerInfo?.cusTargetId, selectedAccounts?.[0]?.accountNo);

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
