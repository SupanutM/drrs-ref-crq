const ejs = require('ejs');
const path = require('path');
const { calculateInstallmentSchedule } = require('../../utils/calculateInstallmentSchedule');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/loan_condition.template.html');

/**
 * เติมกำหนดการชำระหนี้ (วันที่) ให้แต่ละบัญชี ก่อน render — ใช้ ScheduledNextDate จาก CBS
 * (ดู augmentAccountsWithCbsData) + installmentTerms จาก tbl_account_cus_target
 * ใช้ logic เดียวกับที่ contractPdfKitService.js ใช้ตอนสร้าง PDF จริง ให้ preview กับ PDF ตรงกัน
 */
const augmentAccountsWithSchedule = (accounts) => {
    accounts.forEach((acc) => {
        const schedule = calculateInstallmentSchedule(acc.scheduledNextDate, acc.installmentTerms);

        if (acc.isHaircut) {
            // "ชำระภายในวันที่" ใช้ ScheduledNextDate ตรงๆ (ไม่บวกงวด)
            if (!acc.endDate) acc.endDate = schedule.startDateDisplay;
        } else {
            if (!acc.startMonth) acc.startMonth = schedule.startDateDisplay;
            if (!acc.endMonth) acc.endMonth = schedule.endDateDisplay;
        }
    });
    return accounts;
};

/**
 * render HTML สัญญาไว้แสดงบนหน้าเว็บ (ไม่ได้แปลงเป็น PDF)
 *
 * @param {object} customerInfo
 * @param {Array} selectedAccounts
 * @returns {Promise<string>} HTML
 */
const previewContractHtml = async (customerInfo, selectedAccounts) => {
    const accounts = augmentAccountsWithSchedule(Array.isArray(selectedAccounts) ? selectedAccounts : []);

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
