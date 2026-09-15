import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// รูปแบบวันที่ที่ CBS ส่งมา (เช่น ScheduledNextDate จาก Inquiry Account)
const CBS_DATE_FORMAT = "YYYYMMDD";

/**
 * แปลงวันที่แบบ YYYYMMDD จาก CBS (เช่น ScheduledNextDate) เป็น dayjs object
 * @param {string} value - ค่าดิบจาก CBS เช่น "20260902"
 * @returns {import('dayjs').Dayjs|null} - null ถ้า parse ไม่ได้
 */
export const parseCbsDate = (value) => {
    if (!value) return null;
    const parsed = dayjs(String(value), CBS_DATE_FORMAT, true);
    return parsed.isValid() ? parsed : null;
};

/**
 * แปลงวันที่เป็นข้อความรูปแบบไทย (วัน เดือน ปี พ.ศ.) เช่น "2 กันยายน 2569"
 * @param {string|Date|import('dayjs').Dayjs} value
 * @param {string} [fallback] - ข้อความที่แสดงเมื่อ value ไม่ถูกต้อง/ไม่มีค่า
 * @returns {string}
 */
export const formatThaiDate = (value, fallback = "-") => {
    if (!value) return fallback;
    const date = dayjs.isDayjs(value) ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
};

/**
 * คำนวณกำหนดการชำระหนี้จาก ScheduledNextDate + NewMdt (CBS)
 * ใช้ร่วมกันสำหรับทั้งแผนผ่อนชำระ (LT) และแผนปิดบัญชี (Haircut/HC):
 *   - เริ่มชำระงวดแรก / ภายในวันที่ (Haircut) = ScheduledNextDate ตรงๆ
 *   - เสร็จสิ้นภายในวันที่ (ผ่อนชำระ) = NewMdt จาก CBS (Inquiry LoanProcess, SubMethod NEXTPLN1) ตรงๆ
 *     (ตัดสินใจ 2026-09-15 — CBS เป็นผู้คำนวณวันครบกำหนดจริง มีปัจจัยอื่นร่วมด้วย เช่น วันหยุด/
 *     รอบตัดบัญชี ซึ่งคำนวณเอง (ScheduledNextDate + installmentTerms เดือน) ให้ผลไม่ตรงกับ CBS จริง
 *     — เคยเกิดบั๊กจริงมาแล้ว จึงห้ามคำนวณเองแทนเด็ดขาด แม้ CBS ไม่ส่ง NewMdt มาก็ตาม (endDate จะเป็น
 *     null ให้ผู้เรียกโชว์ placeholder แทน ไม่ใช่เดาวันที่)
 *
 * @param {string} scheduledNextDate - ค่าดิบจาก CBS รูปแบบ YYYYMMDD (ScheduledNextDate)
 * @param {string} [endDateRaw] - ค่าดิบจาก CBS รูปแบบ YYYYMMDD (NewMdt)
 * @returns {{ startDate: import('dayjs').Dayjs|null, endDate: import('dayjs').Dayjs|null }}
 */
export const calculateInstallmentSchedule = (scheduledNextDate, endDateRaw) => {
    const startDate = parseCbsDate(scheduledNextDate);
    if (!startDate) {
        return { startDate: null, endDate: null };
    }

    const endDate = parseCbsDate(endDateRaw);

    return { startDate, endDate };
};

/**
 * เช็คว่าวันที่ที่ให้มา "ผ่านไปแล้ว" (ก่อนวันนี้) หรือไม่ — เทียบแค่ระดับวัน (ไม่รวมเวลา)
 * ใช้เช็คว่าแผน Haircut เลยกำหนด expireDate แล้วหรือยัง (เลือกแผนไม่ได้ถ้าเลยแล้ว)
 * ถือว่า "ภายในวันที่" รวมวันนั้นด้วย (ยังเลือกได้ถ้าวันนี้ตรงกับ expireDate เป๊ะ)
 * @param {string|Date|import('dayjs').Dayjs} value
 * @returns {boolean} - false ถ้า value ไม่ถูกต้อง/ไม่มีค่า (ไม่ถือว่าหมดอายุ)
 */
export const isPastDate = (value) => {
    if (!value) return false;
    const date = dayjs.isDayjs(value) ? value : dayjs(value);
    if (!date.isValid()) return false;
    return dayjs().startOf("day").isAfter(date.startOf("day"));
};

export default {
    parseCbsDate,
    formatThaiDate,
    calculateInstallmentSchedule,
    isPastDate,
};
