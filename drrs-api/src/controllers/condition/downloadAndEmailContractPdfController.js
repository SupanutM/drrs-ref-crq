const contractPdfService = require('../../services/condition/downloadAndEmailContractPdfService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractPdfController' });
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');
const emailService = require('../../services/util/emailService');
const { augmentAccountsWithDbData, augmentCustomerInfoWithDbData } = require('../../utils/contractHelper');

const { format } = require('date-fns');

const generateContractController = async (req, res) => {
    try {
        const { customerInfo, selectedAccounts } = req.body;

        logger.info(`Generating contract PDF for customer: ${customerInfo?.citizenId}`);
        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);

        // Fetch customer data from DB directly instead of trusting frontend payload
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(customerInfo?.cusTargetId, selectedAccounts?.[0]?.accountNo);

        const pdfBuffer = await contractPdfService.generateContractPdf(augmentedCustomerInfo, augmentedAccounts);
        logger.info(`PDF generated successfully with length: ${pdfBuffer.length}`);

        // 1. Save PDF to disk
        const currentTimestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const filePrefix = augmentedCustomerInfo.cifNo;
        const filename = `${filePrefix}_${currentTimestamp}.pdf`;
        contractPdfService.savePdfToDisk(pdfBuffer, filename);

        // 2. Send Email asynchronously
        const emailAddress = augmentedCustomerInfo.email;
        if (emailAddress) {
            const emailData = {
                cid: augmentedCustomerInfo.citizenId || 'Unknown',
                email: emailAddress,
                pdfBuffer: pdfBuffer,
                pdfFilename: filename,
                customerName: `${augmentedCustomerInfo.firstName || ''} ${augmentedCustomerInfo.lastName || ''}`.trim(),
                acceptTermCondDate: format(new Date(), 'yyyyMMdd'),
                loanTypeCode: selectedAccounts?.[0]?.planNo || '01',
            };

            emailService.triggerSendContractEmail(emailData).then(async (resEmail) => {
                if (resEmail.isSuccess && selectedAccounts && selectedAccounts.length > 0) {
                    await Promise.all(selectedAccounts.map(async (acc) => {
                        logger.info(`[Step Log] อัปเดต step stepSendMail: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                        await createStepService.updateStepService(acc.accountNo, { stepSendMail: "1" }, 'stepSendMail');
                    }));

                    await systemLogService({
                        step: 'stepSendMail',
                        controller: 'contractPdfController',
                        payload: { customerInfo: customerInfo?.citizenId, selectedAccounts: selectedAccounts.map(a => a.accountNo) },
                        responseStatus: 'SUCCESS',
                        responseMessage: 'Sent email and updated stepSendMail'
                    });
                } else if (!resEmail.isSuccess) {
                    logger.error(`Failed to send email: ${resEmail.message}`);
                }
            }).catch(err => {
                logger.error(`Unhandled error in email trigger: ${err.message}`);
            });
        }

        // Update step and log
        if (selectedAccounts && selectedAccounts.length > 0) {
            await Promise.all(selectedAccounts.map(async (acc) => {
                logger.info(`[Step Log] อัปเดต step stepSendToCbs: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                await createStepService.updateStepService(acc.accountNo, { stepSendToCbs: "1" }, 'stepSendToCbs');
            }));

            await systemLogService({
                step: 'stepSendToCbs',
                controller: 'contractPdfController',
                payload: { customerInfo: customerInfo?.citizenId, selectedAccounts: selectedAccounts.map(a => a.accountNo) },
                responseStatus: 'SUCCESS',
                responseMessage: 'Generated contract and updated stepSendToCbs'
            });
        }

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);
    } catch (error) {
        logger.error(`Error generating contract PDF: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Failed to generate contract PDF',
            error: error.message
        });
    }
};

module.exports = {
    generateContractController
};
