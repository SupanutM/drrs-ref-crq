// ชื่อเดือนภาษาไทย (รูปแบบเดียวกับ formatThaiMonthYear.js)
const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

/**
 * แปลงวันที่แบบ YYYYMMDD จาก CBS (เช่น ScheduledNextDate) เป็น Date (UTC)
 * @param {string} raw - ค่าดิบจาก CBS เช่น "20260902"
 * @returns {Date|null} - null ถ้า parse ไม่ได้
 */
const parseCbsDate = (raw) => {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(String(raw || '').trim());
    if (!match) return null;

    const [, yyyy, mm, dd] = match;
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * บวกจำนวนเดือนเข้ากับวันที่ (คำนวณแบบ UTC)
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
const addMonths = (date, months) => {
    const result = new Date(date.getTime());
    result.setUTCMonth(result.getUTCMonth() + (Number(months) || 0));
    return result;
};

/**
 * แปลง Date เป็นข้อความวันที่แบบไทย (วัน เดือน ปี พ.ศ.) เช่น "2 กันยายน 2569"
 * @param {Date|null} date
 * @returns {string} - ข้อความว่างถ้า date ไม่ถูกต้อง
 */
const formatThaiFullDate = (date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    const day = date.getUTCDate();
    const month = THAI_MONTHS[date.getUTCMonth()];
    const yearBE = date.getUTCFullYear() + 543;
    return `${day} ${month} ${yearBE}`;
};

/**
 * คำนวณกำหนดการชำระหนี้จาก ScheduledNextDate (CBS) และจำนวนงวด (เดือน)
 * ใช้ร่วมกันสำหรับทั้งแผนผ่อนชำระ (LT) และแผนปิดบัญชี (Haircut/HC):
 *   - เริ่มชำระงวดแรก / ภายในวันที่ (Haircut) = ScheduledNextDate ตรงๆ
 *   - เสร็จสิ้นภายในวันที่ (ผ่อนชำระ) = ScheduledNextDate + installmentTerms เดือน
 *     (installmentTerms มาจาก tbl_account_cus_target.installment_terms)
 *
 * @param {string} scheduledNextDate - ค่าดิบจาก CBS รูปแบบ YYYYMMDD
 * @param {number} installmentTerms - จำนวนงวด (เดือน)
 * @returns {{ startDate: Date|null, endDate: Date|null, startDateDisplay: string, endDateDisplay: string }}
 */
const calculateInstallmentSchedule = (scheduledNextDate, installmentTerms) => {
    const startDate = parseCbsDate(scheduledNextDate);
    if (!startDate) {
        return { startDate: null, endDate: null, startDateDisplay: '', endDateDisplay: '' };
    }

    const endDate = addMonths(startDate, installmentTerms);

    return {
        startDate,
        endDate,
        startDateDisplay: formatThaiFullDate(startDate),
        endDateDisplay: formatThaiFullDate(endDate),
    };
};

module.exports = {
    parseCbsDate,
    formatThaiFullDate,
    calculateInstallmentSchedule,
};
