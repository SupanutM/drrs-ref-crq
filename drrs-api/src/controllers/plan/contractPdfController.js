const contractPdfService = require('../../services/plan/contractPdfService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractPdfController' });
const { AppDataSource } = require('../../config/database');
const crypto = require('../../utils/crypto');
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');

const safeDecrypt = (value) => {
    if (!value || typeof value !== 'string') return value;
    if (value.includes(':')) {
        try {
            return crypto.decryptGCM(value, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        } catch (e) {
            return value;
        }
    }
    return value;
};

const augmentAccountsWithDbData = async (accounts) => {
    for (let acc of accounts) {
        if (acc.isHaircut) {
            const query = `SELECT amount FROM tbl_account_hair_cut WHERE account_no = $1 ORDER BY created_date DESC LIMIT 1`;
            const resDb = await AppDataSource.query(query, [acc.accountNo]);
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].amount;
            }
        } else {
            const query = `SELECT installment_amount, installment_term FROM tbl_account_installment WHERE account_no = $1 ORDER BY created_date DESC LIMIT 1`;
            const resDb = await AppDataSource.query(query, [acc.accountNo]);
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].installment_amount;
                acc.installmentTerms = resDb[0].installment_term;
                
                // If there is only one default installment in the array, update it too
                if (acc.installments && acc.installments.length === 1) {
                    acc.installments[0].amount = resDb[0].installment_amount;
                }
            }
        }
    }
    return accounts;
};

const augmentCustomerInfoWithDbData = async (customerInfo) => {
    const cusTargetId = customerInfo?.cusTargetId;
    if (!cusTargetId) return customerInfo;
    const query = `
        SELECT first_name, last_name, tel_no, birthday 
        FROM tbl_cus_target
        WHERE id = $1
    `;
    const resDb = await AppDataSource.query(query, [cusTargetId]);
    
    if (resDb && resDb.length > 0) {
        return {
            ...customerInfo,
            firstName: resDb[0].first_name || safeDecrypt(customerInfo?.firstName),
            lastName: resDb[0].last_name || safeDecrypt(customerInfo?.lastName),
            citizenId: safeDecrypt(customerInfo?.citizenId),
            address: safeDecrypt(customerInfo?.address),
            mobileNo: resDb[0].tel_no,
            birthday: resDb[0].birthday
        };
    }
    
    // If no DB result, still decrypt what we have
    return {
        ...customerInfo,
        firstName: safeDecrypt(customerInfo?.firstName),
        lastName: safeDecrypt(customerInfo?.lastName),
        citizenId: safeDecrypt(customerInfo?.citizenId),
        address: safeDecrypt(customerInfo?.address)
    };
};

const generateContractController = async (req, res) => {
    try {
        const { customerInfo, selectedAccounts } = req.body;

        logger.info(`Generating contract PDF for customer: ${customerInfo?.citizenId}`);
        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);
        
        // Fetch name from DB just to be safe
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(customerInfo || {});

        const pdfBuffer = await contractPdfService.generateContractPdf(augmentedCustomerInfo, augmentedAccounts);
        logger.info(`PDF generated successfully with length: ${pdfBuffer.length}`);

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
            'Content-Disposition': 'attachment; filename="plan_summary.pdf"',
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

const previewContractHtmlController = async (req, res) => {
    try {
        const { customerInfo, selectedAccounts } = req.body;
        logger.info(`Previewing contract HTML for customer: ${customerInfo?.citizenId}`);
        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);
        
        // Fetch name from DB just to be safe
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(customerInfo || {});

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
    generateContractController,
    previewContractHtmlController
};
