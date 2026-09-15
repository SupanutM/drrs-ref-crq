import React from "react";
import PropTypes from "prop-types";

import { calculateInstallmentSchedule, formatThaiDate } from "utils/day";

/**
 * InstallmentSchedule
 *
 * Shared component คำนวณ/แสดงกำหนดการชำระหนี้:
 *   - Haircut      -> "ภายในวันที่" = expireDate (tbl_account_cus_target.expire_date) ตรงๆ
 *                      ไม่ใช้ ScheduledNextDate จาก CBS แล้ว (ตัดสินใจ 2026-09-08)
 *   - ผ่อนชำระ (LT) -> "เริ่มชำระงวดแรก วันที่" = ScheduledNextDate
 *                      "เสร็จสิ้นภายในวันที่" = NewMdt จาก CBS ตรงๆ (ตัดสินใจ 2026-09-15 — ห้ามคำนวณ
 *                      จาก installmentTerms เอง ดู utils/day.js calculateInstallmentSchedule)
 *                      installmentTerms ยังใช้แสดง "จำนวน: X งวด" เฉยๆ ไม่เกี่ยวกับการคำนวณวันที่แล้ว
 *                      ถ้าไม่มีค่า (startDate/endDate เป็น null) ซ่อนบรรทัดนั้นไปเลย ไม่โชว์ "-"
 *                      (ตัดสินใจ 2026-09-15 — เคสนี้เกิดกับบัญชี isRegistered ที่ไม่มี snapshot ใน DB)
 *   - scheduleUnavailable = true (CBS Inquiry แผนผ่อน reject) -> ซ่อนบรรทัดวันที่ไปเลย (ไม่โชว์ "-"
 *     ซ้ำกับข้อความแดงที่ SelectPlanView.js แสดงแยกอยู่แล้วว่าตรวจสอบไม่ได้ — ตัดสินใจ 2026-09-15
 *     กันข้อมูลซ้ำซ้อนบนการ์ดที่ถูก disable ไปแล้วทั้งใบ)
 */
function InstallmentSchedule({ isHaircut, paymentAmount, installmentTerms, scheduledNextDate, endDateRaw, expireDate, scheduleUnavailable }) {
    if (isHaircut) {
        const expireDateDisplay = formatThaiDate(expireDate);
        return (
            <>
                แสดงยอดหนี้ปิดบัญชี: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
                ภายในวันที่ {expireDateDisplay}
            </>
        );
    }

    if (scheduleUnavailable) {
        return (
            <>
                ผ่อนชำระงวดละ: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
                จำนวน: <b>{installmentTerms}</b> งวด <br />
                (อัตราดอกเบี้ย MRR ต่อปี)<br />
            </>
        );
    }

    const { startDate, endDate } = calculateInstallmentSchedule(scheduledNextDate, endDateRaw);

    return (
        <>
            ผ่อนชำระงวดละ: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
            จำนวน: <b>{installmentTerms}</b> งวด <br />
            (อัตราดอกเบี้ย MRR ต่อปี)<br />
            {/* ไม่มีวันที่ (startDate/endDate เป็น null เช่น บัญชี isRegistered ที่ดึงจาก CBS ไม่ได้
                และไม่มี snapshot ใน DB — ดู contractHelper.js) ซ่อนบรรทัดนั้นไปเลย ไม่โชว์ "-"
                (ตัดสินใจ 2026-09-15) */}
            {startDate && <>เริ่มชำระงวดแรก วันที่ {formatThaiDate(startDate)}<br /></>}
            {endDate && <>เสร็จสิ้นภายในวันที่ {formatThaiDate(endDate)}<br /></>}
            {/* โดยท่านตกลงชำระหนี้ให้ธนาคารทั้งหมดในงวดสุดท้าย */}
        </>
    );
}

InstallmentSchedule.propTypes = {
    isHaircut: PropTypes.bool,
    paymentAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    installmentTerms: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    // วันที่ดิบจาก CBS (ScheduledNextDate) รูปแบบ YYYYMMDD — ใช้กับแผนผ่อนชำระ (LT) เท่านั้น
    scheduledNextDate: PropTypes.string,
    // วันเสร็จสิ้นจริงจาก CBS (NewMdt) รูปแบบ YYYYMMDD — ใช้ตรงๆ เท่านั้น ไม่มี fallback คำนวณเอง
    // ถ้าไม่มีค่านี้ endDateDisplay จะเป็น "-" (ดู formatThaiDate) ใช้กับแผนผ่อนชำระ (LT) เท่านั้น
    endDateRaw: PropTypes.string,
    // วันหมดอายุจาก tbl_account_cus_target.expire_date (ISO string / YYYY-MM-DD) — ใช้กับแผน Haircut เท่านั้น
    expireDate: PropTypes.string,
    // true เมื่อ CBS Inquiry แผนผ่อนชำระ (NEXTPLN1) ตอบ REJECT — ซ่อนบรรทัดวันที่ทั้งคู่ไปเลย
    // (การ์ดถูก disable ทั้งใบอยู่แล้ว ไม่ต้องโชว์ "-" ซ้ำกับข้อความแดงแยกที่ SelectPlanView.js)
    scheduleUnavailable: PropTypes.bool,
};

InstallmentSchedule.defaultProps = {
    isHaircut: false,
    paymentAmount: 0,
    installmentTerms: 0,
    scheduledNextDate: "",
    endDateRaw: "",
    expireDate: "",
    scheduleUnavailable: false,
};

export default InstallmentSchedule;
