// ใช้ service ที่สร้าง PDF ด้วย pdfkit (ไม่เปิด Chromium) แทน puppeteer เดิม
const contractPdfService = require('../../services/condition/contractPdfKitService');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'generateContractController' });
const createStepService = require('../../services/util/systemLog/createStepService');
const { systemLogService } = require('../../services/util/systemLog/systemLogService');
const emailService = require('../../services/util/emailService');
const { registerDigitalLoanService } = require('../../services/register/registerDigitalLoanService');
const { saveContractFileService } = require('../../services/condition/saveContractFileService');
const { augmentAccountsWithDbData, augmentCustomerInfoWithDbData, augmentAccountsWithCbsData } = require('../../utils/contractHelper');
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

        // ตอน "ยอมรับสัญญา" — ดึงข้อมูลบัญชีล่าสุดจาก CBS (วงเงิน/ยอดคงเหลือ/ดอกเบี้ย)
        // มาใส่ในสัญญา ก่อนลงทะเบียน/สร้าง PDF (ไม่ throw ถ้า CBS inquiry ล้มเหลว — ใช้ข้อมูลจาก DB/frontend ต่อไป)
        await augmentAccountsWithCbsData(augmentedAccounts);

        // Fetch customer data from DB directly instead of trusting frontend payload
        const augmentedCustomerInfo = await augmentCustomerInfoWithDbData(cusTargetId, selectedAccounts?.[0]?.accountNo);

        // ==========================================
        // STEP 1: ยอมรับสัญญา — ลงทะเบียนแผนกับ CBS จริงก่อน (CBS_REGIS_DIGITALLOAN_URL)
        // ==========================================
        // ต้องทำ "ก่อน" สร้าง PDF เพราะ PDF ต้องมีแค่บัญชีที่ CBS รับจริง (Status: SUCCESS)
        // บัญชีที่ CBS ปฏิเสธ (REJECT) จะไม่ถูกใส่ในสัญญา และไม่ตั้ง stepSendToCbs — ลูกค้ากลับมาทำใหม่ได้
        const successAccounts = [];
        const rejectedAccounts = [];

        if (augmentedAccounts && augmentedAccounts.length > 0) {
            await Promise.all(augmentedAccounts.map(async (acc) => {
                try {
                    const regResult = await registerDigitalLoanService({
                        accountNo: acc.accountNo,
                        isHaircut: !!acc.isHaircut,
                        paymentAmount: acc.paymentAmount,
                        installmentTerms: acc.installmentTerms,
                        scheduledNextDate: acc.scheduledNextDate,
                    });

                    if (regResult.success) {
                        successAccounts.push(acc);
                        // ตั้ง stepSendToCbs = "1" เฉพาะบัญชีที่ CBS ยืนยัน SUCCESS จริงเท่านั้น
                        await createStepService.updateStepService(acc.accountNo, { stepSendToCbs: "1" }, 'stepSendToCbs');
                        // เก็บ response ดิบจาก CBS ลง tbl_system_log ไว้ตรวจสอบย้อนหลังได้
                        // (regResult.data มี TimeStamp/Status/Desc ตามที่ CBS ตอบมา)
                        await systemLogService({
                            step: 'SEND_TO_CBS_SUCCESS',
                            controller: 'contractPdfController',
                            payload: { cusTargetId, accountNo: acc.accountNo },
                            responseStatus: 200,
                            response: { message: 'ลงทะเบียนแผนกับ CBS สำเร็จ', cbsResponse: regResult.data }
                        }).catch((err) => logger.error(`บันทึก audit SEND_TO_CBS_SUCCESS ไม่สำเร็จ: ${err.message}`));
                        return;
                    }

                    // ครอบทั้งเคส HTTP error (regResult.error) และเคส CBS ตอบ 200 แต่ Status: "REJECT"
                    // (regResult.data มี TimeStamp/Status/Desc ตามที่ CBS ตอบมาให้ตรวจสอบย้อนหลังได้)
                    logger.warn(`[CBS Register] ลงทะเบียนแผนไม่สำเร็จสำหรับ ${acc.accountNo}: ${regResult.message}`);
                    rejectedAccounts.push({ accountNo: acc.accountNo, message: regResult.message });
                    await systemLogService({
                        step: 'SEND_TO_CBS_FAIL',
                        controller: 'contractPdfController',
                        payload: { cusTargetId, accountNo: acc.accountNo },
                        responseStatus: regResult.status || 200,
                        response: { message: regResult.message, error: regResult.error, cbsResponse: regResult.data }
                    }).catch((err) => logger.error(`บันทึก audit SEND_TO_CBS_FAIL ไม่สำเร็จ: ${err.message}`));
                } catch (error) {
                    logger.warn(`[CBS Register] เกิดข้อผิดพลาดขณะลงทะเบียนแผนสำหรับ ${acc.accountNo}: ${error.message}`);
                    rejectedAccounts.push({ accountNo: acc.accountNo, message: 'เกิดข้อผิดพลาดในระบบขณะติดต่อ CBS' });
                }
            }));

            await systemLogService({
                step: 'SEND_TO_CBS',
                controller: 'contractPdfController',
                payload: { cusTargetId, selectedAccounts: selectedAccounts.map(a => a.accountNo) },
                responseStatus: 200,
                response: {
                    message: 'ยอมรับสัญญา ลงทะเบียนกับ CBS',
                    successAccounts: successAccounts.map(a => a.accountNo),
                    rejectedAccounts: rejectedAccounts.map(a => a.accountNo)
                }
            });
        }

        // ทุกบัญชีถูก CBS ปฏิเสธ — ไม่มีบัญชีไหนพอสร้างสัญญาได้เลย ไม่ต้องสร้าง PDF/ส่งเมล
        if (successAccounts.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'ไม่สามารถ ลงทะเบียนเข้าร่วมมาตรการได้กรุณาลองใหม่อีกครั้ง',
                rejectedAccounts,
            });
        }

        // ==========================================
        // STEP 2: สร้างไฟล์สัญญา (PDF) — เฉพาะบัญชีที่ CBS ลงทะเบียนสำเร็จ (successAccounts)
        // ==========================================
        // service คืน 2 เวอร์ชันจากเอกสารชุดเดียว:
        //   preview  = ไม่ใส่รหัส สำหรับโชว์บนจอ (react-pdf ไม่เด้งถามรหัส)
        //   download = ใส่รหัส (วันเกิดลูกค้า) สำหรับดาวน์โหลด/เก็บ/ส่งเมล
        const { preview: previewBuffer, download: downloadBuffer } =
            await contractPdfService.generateContractPdf(augmentedCustomerInfo, successAccounts);
        // logger.info(`PDF generated successfully (preview ${previewBuffer.length} / download ${downloadBuffer.length} bytes)`);

        const currentTimestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const filePrefix = augmentedCustomerInfo.cifNo;
        const filename = `${filePrefix}_${currentTimestamp}.pdf`;

        // ==========================================
        // STEP 2.5: เก็บไฟล์สัญญา (base64 ตัวไม่มีรหัส = preview) ลง tbl_contract_file สำหรับ reprint ย้อนหลัง
        // ==========================================
        // เลิกเขียนไฟล์ลงดิสก์แล้ว เก็บสำเนาไว้ใน table เฉพาะ (ไม่ใช่ tbl_system_log แล้ว)
        // หมายเหตุ: เก็บ "ตัวไม่มีรหัส" (preview) เพื่อให้ admin เปิดดูได้โดยไม่ต้องรู้วันเกิดลูกค้า
        await saveContractFileService({
            cusTargetId,
            fileName: filename,
            base64Content: previewBuffer.toString('base64'),
            accounts: successAccounts
        }).catch((err) => logger.error(`บันทึกไฟล์สัญญาลง tbl_contract_file ไม่สำเร็จ (${filename}): ${err.message}`));

        // ==========================================
        // STEP 3: ส่งไฟล์ให้หน้าเว็บเป็น base64
        // ==========================================
        // ส่ง 2 เวอร์ชันจากเอกสารชุดเดียว (เนื้อหาตรงกัน 100%):
        //   base64Preview  = โชว์บนจอ (ไม่มีรหัส เบราว์เซอร์เปิดได้เลย)
        //   base64Download = ดาวน์โหลด (มีรหัสวันเกิด เก็บเป็นหลักฐาน)
        // จอกับไฟล์จึงตรงกัน แต่จอไม่ถูกถามรหัส
        // rejectedAccounts (ถ้ามี) ให้หน้าเว็บแจ้งเตือนลูกค้าว่าบัญชีไหนไม่สำเร็จ แต่ยังดาวน์โหลด
        // สัญญาของบัญชีที่สำเร็จได้ตามปกติ (hasPartialFailure = true)
        res.json({
            success: true,
            base64: downloadBuffer.toString('base64'),     // เผื่อ client เก่า (ถ้ามี) — เป็นตัว download
            base64Preview: previewBuffer.toString('base64'),
            base64Download: downloadBuffer.toString('base64'),
            fileName: filename,
            hasPartialFailure: rejectedAccounts.length > 0,
            rejectedAccounts,
            successAccountNos: successAccounts.map(a => a.accountNo)
        });

        // หมายเหตุ: ไม่เก็บไฟล์ PDF ลงดิสก์ที่ backend อีกต่อไป (เลิกเปลือง Disk IO)
        // ไฟล์ถูกส่งกลับเป็น base64 ให้หน้าเว็บแล้ว (STEP 3) ถ้าต้องเก็บสำเนา
        // ให้ระบบปลายทาง (เช่น document store / CBS) รับ base64 ไปเก็บเอง

        // ==========================================
        // STEP 4: ส่ง E-mail — เฉพาะบัญชีที่สำเร็จ (successAccounts) เท่านั้น
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
                loanTypeCode: successAccounts?.[0]?.planNo || '01',
            };

            // ปล่อยให้ทำงานเป็น Asynchronous พื้นหลัง
            emailService.triggerSendContractEmail(emailData).then(async (resEmail) => {
                if (resEmail.isSuccess && successAccounts.length > 0) {
                    await Promise.all(successAccounts.map(async (acc) => {
                        // logger.info(`[Step Log] อัปเดต step stepSendMail: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                        await createStepService.updateStepService(acc.accountNo, { stepSendMail: "1" }, 'stepSendMail');
                    }));

                    await systemLogService({
                        step: 'SEND_MAIL',
                        controller: 'contractPdfController',
                        payload: { cusTargetId, selectedAccounts: successAccounts.map(a => a.accountNo) },
                        responseStatus: 200,
                        response: { message: 'ส่งอีเมลสำเร็จ อัปเดต stepSendMail' }
                    });
                } else if (!resEmail.isSuccess) {
                    logger.error(`Failed to send email: ${resEmail.message}`);
                    // audit: เมลส่งไม่สำเร็จ — ตรวจย้อนหลังได้ว่าใครไม่ได้รับเมลสัญญา
                    await systemLogService({
                        step: 'SEND_MAIL_FAIL',
                        controller: 'contractPdfController',
                        payload: { cusTargetId, selectedAccounts: successAccounts.map(a => a.accountNo) },
                        responseStatus: 500,
                        response: { message: 'ส่งอีเมลสัญญาไม่สำเร็จ', error: resEmail.message }
                    }).catch(logErr => logger.error(`บันทึก audit SEND_MAIL_FAIL ไม่สำเร็จ: ${logErr.message}`));
                }
            }).catch(async err => {
                logger.error(`Unhandled error in email trigger: ${err.message}`);
                // audit: error หลุด (นอกเหนือจาก resEmail.isSuccess) เช่น DNS/SMTP ล่ม
                await systemLogService({
                    step: 'SEND_MAIL_FAIL',
                    controller: 'contractPdfController',
                    payload: { cusTargetId, selectedAccounts: successAccounts.map(a => a.accountNo) },
                    responseStatus: 500,
                    response: { message: 'ส่งอีเมลสัญญาไม่สำเร็จ (unhandled)', error: err.message }
                }).catch(logErr => logger.error(`บันทึก audit SEND_MAIL_FAIL ไม่สำเร็จ: ${logErr.message}`));
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
