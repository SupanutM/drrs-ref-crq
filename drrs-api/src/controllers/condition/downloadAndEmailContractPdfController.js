// ใช้ service ที่สร้าง PDF ด้วย pdfkit (ไม่เปิด Chromium) แทน puppeteer เดิม
const contractPdfService = require('../../services/condition/contractPdfKitService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'generateContractController' });
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');
const emailService = require('../../services/util/emailService');
const { augmentAccountsWithDbData, augmentCustomerInfoWithDbData } = require('../../utils/contractHelper');
const { ownsAccount } = require('../../middleware/authMiddleware');

const { format } = require('date-fns');

const generateContractController = async (req, res) => {
    try {
        const { selectedAccounts } = req.body;
        // cusTargetId มาจาก session token (req.auth) ไม่เชื่อค่าจาก body (กัน IDOR)
        const cusTargetId = req.auth?.cusTargetId;
        if (!cusTargetId) {
            return res.status(401).json({ success: false, message: 'unauthorized' });
        }

        // เช็กว่าทุกบัญชีที่ขอทำสัญญาเป็นของเจ้าของ session จริง
        for (const acc of (selectedAccounts || [])) {
            if (!ownsAccount(req, acc.accountNo)) {
                logger.warn(`[IDOR Block] accountNo ${acc.accountNo} ไม่ได้เป็นของ session นี้`);
                return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการกับบัญชีนี้' });
            }
        }

        const augmentedAccounts = await augmentAccountsWithDbData(selectedAccounts || []);

        // Fetch customer data from DB directly instead of trusting frontend payload
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(cusTargetId, selectedAccounts?.[0]?.accountNo);

        // ==========================================
        // STEP 1: สร้างไฟล์สัญญา (PDF)
        // ==========================================
        // ต้องทำ "ก่อน" ตั้ง stepSendToCbs
        //
        // เดิมโค้ดตั้ง stepSendToCbs = "1" ก่อนสร้าง PDF ซึ่งถ้า PDF พังจะเกิดเรื่องนี้:
        //   verifyController จะบล็อกลูกค้าที่มี stepConfirmPlan=1 และ stepSendToCbs=1
        //   ทุกบัญชี ด้วย 403 "ท่านได้ลงทะเบียนปรับปรุงโครงสร้างหนี้เรียบร้อยแล้ว"
        //   ผลคือลูกค้าถูกมาร์คว่าทำเสร็จ เข้าระบบใหม่ไม่ได้ตลอดไป แต่ไม่เคยได้สัญญา
        //   ต้องให้ทีมงานเข้าไปแก้ DB ให้ทีละคน
        // สลับลำดับแล้ว ถ้า PDF พังลูกค้าจะยังกลับมาทำใหม่ได้เอง
        // service คืน 2 เวอร์ชันจากเอกสารชุดเดียว:
        //   preview  = ไม่ใส่รหัส สำหรับโชว์บนจอ (react-pdf ไม่เด้งถามรหัส)
        //   download = ใส่รหัส (วันเกิดลูกค้า) สำหรับดาวน์โหลด/เก็บ/ส่งเมล
        const { preview: previewBuffer, download: downloadBuffer } =
            await contractPdfService.generateContractPdf(augmentedCustomerInfo, augmentedAccounts);
        logger.info(`PDF generated successfully (preview ${previewBuffer.length} / download ${downloadBuffer.length} bytes)`);

        const currentTimestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const filePrefix = augmentedCustomerInfo.cifNo;
        const filename = `${filePrefix}_${currentTimestamp}.pdf`;

        // ==========================================
        // STEP 2: ยอมรับสัญญา (ส่งไป CBS)
        // ==========================================
        if (selectedAccounts && selectedAccounts.length > 0) {
            await Promise.all(selectedAccounts.map(async (acc) => {
                logger.info(`[Step Log] อัปเดต step stepSendToCbs: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                await createStepService.updateStepService(acc.accountNo, { stepSendToCbs: "1" }, 'stepSendToCbs');
            }));

            await systemLogService({
                step: 'stepSendToCbs',
                controller: 'contractPdfController',
                payload: { cusTargetId, selectedAccounts: selectedAccounts.map(a => a.accountNo) },
                responseStatus: 'SUCCESS',
                responseMessage: 'Updated stepSendToCbs (Accepted Contract)'
            });
        }

        // ==========================================
        // STEP 3: ส่งไฟล์ให้หน้าเว็บเป็น base64
        // ==========================================
        // ส่ง 2 เวอร์ชันจากเอกสารชุดเดียว (เนื้อหาตรงกัน 100%):
        //   base64Preview  = โชว์บนจอ (ไม่มีรหัส เบราว์เซอร์เปิดได้เลย)
        //   base64Download = ดาวน์โหลด (มีรหัสวันเกิด เก็บเป็นหลักฐาน)
        // จอกับไฟล์จึงตรงกัน แต่จอไม่ถูกถามรหัส
        res.json({
            success: true,
            base64: downloadBuffer.toString('base64'),     // เผื่อ client เก่า (ถ้ามี) — เป็นตัว download
            base64Preview: previewBuffer.toString('base64'),
            base64Download: downloadBuffer.toString('base64'),
            fileName: filename
        });

        // ==========================================
        // STEP 3.5: เก็บสำเนาลงดิสก์ (ใช้เวอร์ชันมีรหัส)
        // ==========================================
        // ทำ "หลัง" ตอบ response แล้ว ผู้ใช้จึงไม่ต้องรอเขียนดิสก์เสร็จ
        contractPdfService.savePdfToDisk(downloadBuffer, filename).catch((error) => {
            logger.error(`เก็บสำเนาสัญญาลงดิสก์ไม่สำเร็จ (${filename}): ${error.message}`);
        });

        // ==========================================
        // STEP 4: ส่ง E-mail
        // ==========================================
        const emailAddress = augmentedCustomerInfo.email;
        if (emailAddress) {
            const emailData = {
                cid: augmentedCustomerInfo.citizenId || 'Unknown',
                email: emailAddress,
                pdfBuffer: downloadBuffer,
                pdfFilename: filename,
                customerName: `${augmentedCustomerInfo.firstName || ''} ${augmentedCustomerInfo.lastName || ''}`.trim(),
                acceptTermCondDate: format(new Date(), 'yyyyMMdd'),
                loanTypeCode: selectedAccounts?.[0]?.planNo || '01',
            };

            // ปล่อยให้ทำงานเป็น Asynchronous พื้นหลัง
            emailService.triggerSendContractEmail(emailData).then(async (resEmail) => {
                if (resEmail.isSuccess && selectedAccounts && selectedAccounts.length > 0) {
                    await Promise.all(selectedAccounts.map(async (acc) => {
                        logger.info(`[Step Log] อัปเดต step stepSendMail: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                        await createStepService.updateStepService(acc.accountNo, { stepSendMail: "1" }, 'stepSendMail');
                    }));

                    await systemLogService({
                        step: 'stepSendMail',
                        controller: 'contractPdfController',
                        payload: { cusTargetId, selectedAccounts: selectedAccounts.map(a => a.accountNo) },
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
    } catch (error) {
        logger.error(`Error generating contract PDF: ${error.message}`);

        // ถ้าส่ง response ออกไปแล้ว (พังหลัง res.send) จะส่ง header ซ้ำไม่ได้
        if (res.headersSent) {
            return;
        }

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
