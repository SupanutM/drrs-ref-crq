const pdfService = require('../../services/condition/downloadConditionPdfService');
const baseLogger = require('../../utils/logger');
const createStepService = require('../../services/util/systemLog/createStepService');
const logger = baseLogger.child({ context: 'generatePdfController' });

const generatePdfController = async (req, res) => {
    try {
        // logger.info(`[generatePdf] เริ่มสร้าง PDF (conditionYear: ${req.body?.conditionYear || '-'})`)
        const base64Pdf = await pdfService.generateInvoiceBase64(req.body);



        res.json({
            success: true,
            base64: base64Pdf,
            fileName: `condition_${req.body.conditionYear || ''}.pdf`
        });

    } catch (error) {
        // เก็บรายละเอียด error ไว้ใน log ฝั่งเซิร์ฟเวอร์เท่านั้น
        // ไม่ส่ง error.message กลับไปให้ client (อาจมี path ไฟล์/ข้อมูลระบบหลุดออกไป)
        logger.error(`[generatePdf] สร้าง PDF ไม่สำเร็จ: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'ไม่สามารถสร้างเอกสารได้ กรุณาลองใหม่อีกครั้ง'
        });
    }
};

module.exports = {
    generatePdfController
};