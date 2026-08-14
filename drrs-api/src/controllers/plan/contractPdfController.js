const contractPdfService = require('../../services/plan/contractPdfService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'contractPdfController' });
const { AppDataSource } = require('../../config/database');
const crypto = require('../../utils/crypto');
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');
const emailService = require('../../services/util/emailService');
const tblAccountHairCut = require('../../entities/tblAccountHairCut');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
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
            const resDb = await AppDataSource.getRepository(tblAccountHairCut).find({
                select: { amount: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].amount;
            }
        } else {
            const resDb = await AppDataSource.getRepository(tblAccountInstallment).find({
                select: { installmentAmount: true, installmentTerm: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].installmentAmount;
                acc.installmentTerms = resDb[0].installmentTerm;

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
    if (!customerInfo) return {};

    // ข้อมูลทุกอย่างส่งมาจาก Frontend ครบแล้ว ไม่ต้อง Query DB ซ้ำ
    return {
        ...customerInfo,
        firstName: safeDecrypt(customerInfo?.firstName),
        lastName: safeDecrypt(customerInfo?.lastName),
        citizenId: safeDecrypt(customerInfo?.citizenId),
        cifNo: safeDecrypt(customerInfo?.cifNo),
        address: safeDecrypt(customerInfo?.address),
        email: safeDecrypt(customerInfo?.email),
        mobileNo: safeDecrypt(customerInfo?.telNo), // รองรับทั้งสองชื่อตัวแปร
        birthday: customerInfo?.birthday || customerInfo?.dateOfBirth // รองรับทั้งสองชื่อตัวแปรเผื่อ Frontend ส่งมาต่างกัน
    };
};

const { format } = require('date-fns');

const generateContractController = async (req, res) => {
    try {
        const { customerInfo, selectedAccounts } = req.body;

        logger.info(`Generating contract PDF for customer: ${customerInfo?.citizenId}`);
        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);

        // Fetch name from DB just to be safe
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(customerInfo || {});

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

            emailService.triggerSendContractEmail(emailData).catch(err => {
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
