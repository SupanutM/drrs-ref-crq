const { PDFDocument } = require('pdf-lib-plus-encrypt');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'pdfSecurityHelper' });

const DEFAULT_PERMISSIONS = {
    printing: 'highResolution',
    modifying: false,
    copying: false,
    annotating: false,
    fillingForms: false,
    contentAccessibility: true,
    documentAssembly: false
};

/**
 * แปลงรหัสผ่านดิบให้อยู่ในรูปที่ใช้เปิดไฟล์ (DDMMYYYY)
 * ค่าที่ส่งเข้ามาคือวันเกิดลูกค้าในรูป YYYYMMDD
 *
 * @param {string} rawPasswordString
 * @returns {string} รหัสผ่านที่จัดรูปแล้ว หรือค่าว่างถ้าใช้ไม่ได้
 */
const formatPdfPassword = (rawPasswordString) => {
    const cleaned = String(rawPasswordString || '').replace(/[^a-zA-Z0-9]/g, '');

    // YYYYMMDD -> DDMMYYYY
    if (cleaned.length === 8) {
        const yyyy = cleaned.substring(0, 4);
        const mm = cleaned.substring(4, 6);
        const dd = cleaned.substring(6, 8);
        return `${dd}${mm}${yyyy}`;
    }

    return cleaned;
};

/**
 * ใส่รหัสผ่านให้เอกสาร PDF ที่โหลดไว้แล้ว (แก้ในตัวเอกสาร ไม่ต้อง load ใหม่)
 *
 * ใช้ตอนที่มี PDFDocument อยู่ในมือแล้ว เช่นหลัง merge เสร็จ
 * จะได้ไม่ต้อง save เป็น Buffer แล้ว load กลับมาอีกรอบ
 *
 * @param {import('pdf-lib-plus-encrypt').PDFDocument} pdfDoc
 * @param {string} rawPasswordString วันเกิดลูกค้ารูป YYYYMMDD
 * @returns {boolean} true = ใส่รหัสแล้ว, false = ไม่มีรหัสที่ใช้ได้ จึงไม่ใส่
 */
const applyPdfEncryption = (pdfDoc, rawPasswordString) => {
    const userPassword = formatPdfPassword(rawPasswordString);

    if (!userPassword) {
        logger.warn('[PDF Security]: ไม่มีรหัสผ่านที่ใช้ได้ คืนไฟล์แบบไม่ใส่รหัส');
        return false;
    }

    // คงค่า fallback เดิมไว้ ไม่เปลี่ยนพฤติกรรมของไฟล์ที่ออกไปแล้ว
    // หมายเหตุ: ค่า fallback นี้ hardcode อยู่ในซอร์ส จึงอ่านได้จาก repo
    // ควรย้ายไปตั้งใน .env เป็น PDF_OWNER_PASSWORD (แยกเป็นอีกเรื่องหนึ่ง)
    const ownerPassword = process.env.PDF_OWNER_PASSWORD || 'GSB_SECRET_KEY_DRRS';

    pdfDoc.encrypt({
        userPassword,
        ownerPassword,
        permissions: DEFAULT_PERMISSIONS
    });

    // ไม่ log ค่ารหัสผ่าน เพราะรหัสคือวันเกิดลูกค้า (ข้อมูลส่วนบุคคล)
    // เดิมบรรทัดนี้พิมพ์ `userPassword set to: ${formattedPassword}` ลงไฟล์ log
    logger.info('[PDF Security]: ใส่รหัสผ่านให้ไฟล์ PDF แล้ว');
    return true;
};

/**
 * ใส่รหัสผ่านให้ PDF ที่อยู่ในรูป Buffer
 *
 * @param {Buffer} pdfBuffer ไฟล์ PDF ที่ยังไม่ใส่รหัส
 * @param {string} rawPasswordString วันเกิดลูกค้ารูป YYYYMMDD
 * @returns {Promise<Buffer>} ไฟล์ PDF ที่ใส่รหัสแล้ว
 */
const encryptPdfBuffer = async (pdfBuffer, rawPasswordString) => {
    if (!formatPdfPassword(rawPasswordString)) {
        logger.warn('[PDF Security]: ไม่มีรหัสผ่านที่ใช้ได้ คืนไฟล์แบบไม่ใส่รหัส');
        return pdfBuffer;
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        applyPdfEncryption(pdfDoc, rawPasswordString);
        const encryptedBytes = await pdfDoc.save({ useObjectStreams: false });
        return Buffer.from(encryptedBytes);
    } catch (error) {
        logger.error(`[PDF Security]: ใส่รหัสผ่านให้ PDF ไม่สำเร็จ: ${error.message}`);
        throw error;
    }
};

module.exports = {
    encryptPdfBuffer,
    applyPdfEncryption,
    formatPdfPassword
};
