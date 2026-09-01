const ejs = require('ejs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/loan_condition.template.html');

/**
 * render HTML สัญญาไว้แสดงบนหน้าเว็บ (ไม่ได้แปลงเป็น PDF)
 *
 * @param {object} customerInfo
 * @param {Array} selectedAccounts
 * @returns {Promise<string>} HTML
 */
const previewContractHtml = async (customerInfo, selectedAccounts) => {
    const accounts = Array.isArray(selectedAccounts) ? selectedAccounts : [];

    return ejs.renderFile(TEMPLATE_PATH, {
        customerInfo: customerInfo || {},
        selectedAccounts: accounts
    });
};

// หมายเหตุ: เดิมไฟล์นี้มีฟังก์ชัน savePdfToDisk(pdfBuffer, filename) ติดมาด้วย
// ซึ่งเป็นโค้ดที่คัดลอกมาจาก downloadAndEmailContractPdfService และไม่มีใครเรียกใช้
// (service นี้คืน HTML ไม่มี PDF buffer เลย) จึงลบออกเพื่อไม่ให้เข้าใจผิด

module.exports = {
    previewContractHtml
};
