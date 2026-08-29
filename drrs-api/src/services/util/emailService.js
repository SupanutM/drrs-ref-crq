const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { parse, isValid, format, addYears } = require("date-fns");
const { th } = require("date-fns/locale");
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'emailService' });

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    tls: {
        rejectUnauthorized: false,
    },
});

async function triggerSendContractEmail(data) {
    try {
        // ระหว่าง Load Test: ข้ามการส่งอีเมลทั้งหมด
        // (อ่าน template จากดิสก์ทุกนัด + ต่อ SMTP ไป email ปลอมที่ค้าง/ช้า
        //  = เพิ่ม Disk IO และงานค้างโดยไม่จำเป็นต่อการวัดประสิทธิภาพแอป)
        if (require('../../config/env').loadTestMode) {
            logger.warn('[LOAD_TEST_MODE] ข้ามการส่งอีเมลสัญญา');
            return { isSuccess: false, message: 'skipped in load test mode' };
        }

        const {
            cid,
            email,
            pdfBuffer, // We receive the already-encrypted buffer directly
            pdfFilename, // The name for the attachment
            customerName,
            acceptTermCondDate,
            loanTypeCode,
        } = data;

        if (!email || !pdfBuffer || !pdfFilename || !customerName || !acceptTermCondDate || !loanTypeCode || !cid) {
            throw new Error("Missing required fields for email");
        }

        const PLAN_NAME_MAP = {
            "01": "มาตรการผ่อนบ้านดี GSB ลดให้",
            "02": "มาตรการบ้านของคุณให้ออมสินดูแลต่อ",
        };

        const plan_name = PLAN_NAME_MAP[loanTypeCode];
        if (!plan_name) {
            throw new Error(`Unknown loan type code: ${loanTypeCode}`);
        }

        const templatePath = path.join(__dirname, '../../templates/email_contract.template.html');
        if (!fs.existsSync(templatePath)) {
            logger.error(`Email template not found at ${templatePath}`);
            return {
                isSuccess: false,
                message: "Template not found",
            };
        }

        // Parse date (assumes yyyyMMdd format from frontend/db)
        const parse_accept_date = parse(acceptTermCondDate, "yyyyMMdd", new Date());
        if (!isValid(parse_accept_date)) {
            logger.error(`Invalid accept_date format: ${acceptTermCondDate}`);
            return {
                code: 400,
                message: "Invalid accept_date format",
            };
        }

        let html = fs.readFileSync(templatePath, "utf-8");
        html = html.replace(/{{name}}/g, customerName);
        html = html.replace(/{{plan_name}}/g, plan_name);
        html = html.replace(
            /{{accept_date}}/g,
            format(addYears(parse_accept_date, 543), "dd MMMM yyyy", { locale: th })
        );
        html = html.replace(/{{attachments}}/g, pdfFilename);

        const attachments = [
            {
                filename: pdfFilename,
                content: pdfBuffer,
                contentType: "application/pdf",
            }
        ];

        // logger.info(`Sending contract email (loanType: ${loanTypeCode})`);

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: "สำเนาไฟล์สัญญาอิเล็กทรอนิกส์ (e-Contract) ของสินเชื่อที่ท่านแจ้งความประสงค์เข้าร่วมมาตรการฯ ของธนาคาร",
            html,
            attachments,
        });

        // logger.info(`Email sent successfully (loanType: ${loanTypeCode})`);
        return {
            isSuccess: true,
            message: "Email sent successfully",
        };
    } catch (error) {
        logger.error(`Error triggering send contract email: ${error.message}`);
        return {
            isSuccess: false,
            message: error.message || "Failed to send email",
        };
    }
}

module.exports = {
    triggerSendContractEmail
};
