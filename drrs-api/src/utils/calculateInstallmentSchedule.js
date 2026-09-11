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
 * แปลงค่าวันที่จาก column type "date" ของ TypeORM/PostgreSQL เป็น Date (UTC)
 * รองรับทั้ง Date object (driver บางเวอร์ชัน parse ให้แล้ว) และ string รูปแบบ "YYYY-MM-DD"
 * @param {Date|string|null} raw
 * @returns {Date|null} - null ถ้า parse ไม่ได้
 */
const parseDbDate = (raw) => {
    if (!raw) return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).trim());
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
 * แปลง Date เป็นข้อความรูปแบบ YYYYMMDD (ค.ศ.) — ใช้ส่งให้ CBS (เช่น Plan1ExpireDate)
 * @param {Date|null} date
 * @returns {string} - ข้อความว่างถ้า date ไม่ถูกต้อง
 */
const formatYYYYMMDD = (date) => {
    if (!date || Number.isNaN(date.getTime())) return '';
    const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
};

/**
 * เวลาปัจจุบัน "เฉพาะวันที่" ตาม timezone ไทย (UTC+7) — ตัดส่วนเวลาออก
 * คำนวณจาก Date.now() (เป็น UTC เสมอ) แล้วบวกออฟเซ็ต 7 ชม. เอง — ไม่พึ่ง TZ ของ OS/process
 * (กันกรณี server ตั้ง TZ ไว้คนละค่ากับที่คาด ผลลัพธ์จะเพี้ยนไปทั้งวัน)
 * @returns {Date} - เที่ยงคืนของ "วันนี้" ตามเวลาไทย เก็บเป็น UTC date object เพื่อเทียบกับ
 *   parseDbDate/parseCbsDate ได้ตรงกัน (ทั้งคู่เก็บเป็นปฏิทินวันเดียว ไม่มีเวลา)
 */
const nowBangkokDateOnly = () => {
    const bangkokMs = Date.now() + 7 * 60 * 60 * 1000;
    const d = new Date(bangkokMs);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * เช็คว่าวันที่ที่ให้มา "ผ่านไปแล้ว" (ก่อนวันนี้ตามเวลาไทย) หรือไม่ — เทียบแค่ระดับวัน (ไม่รวมเวลา)
 * ใช้เช็คว่าแผน Haircut เลยกำหนด expire_date แล้วหรือยัง (ฝั่ง server เป็นคนตัดสิน ไม่เชื่อ client clock)
 * ถือว่า "ภายในวันที่" รวมวันนั้นด้วย (ยังไม่ expired ถ้าวันนี้ตรงกับวันที่ระบุเป๊ะ)
 * @param {Date|null} date - ต้องเป็น Date ที่ parse แล้ว (เช่นจาก parseDbDate/parseCbsDate)
 * @returns {boolean} - false ถ้า date ไม่ถูกต้อง/ไม่มีค่า (ไม่ถือว่าหมดอายุ)
 */
const isPastDate = (date) => {
    if (!date || Number.isNaN(date.getTime())) return false;
    const today = nowBangkokDateOnly();
    return today.getTime() > date.getTime();
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
    parseDbDate,
    formatThaiFullDate,
    formatYYYYMMDD,
    nowBangkokDateOnly,
    isPastDate,
    calculateInstallmentSchedule,
};
