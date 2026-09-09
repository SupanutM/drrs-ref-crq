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
 *                      "เสร็จสิ้นภายในวันที่" = ScheduledNextDate + installmentTerms เดือน
 *                      (installmentTerms มาจาก tbl_account_cus_target.installment_terms)
 */
function InstallmentSchedule({ isHaircut, paymentAmount, installmentTerms, scheduledNextDate, expireDate }) {
    if (isHaircut) {
        const expireDateDisplay = formatThaiDate(expireDate);
        return (
            <>
                แสดงยอดหนี้ปิดบัญชี: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
                ภายในวันที่ {expireDateDisplay}
            </>
        );
    }

    const { startDate, endDate } = calculateInstallmentSchedule(scheduledNextDate, installmentTerms);
    const startDateDisplay = formatThaiDate(startDate);
    const endDateDisplay = formatThaiDate(endDate);

    return (
        <>
            ผ่อนชำระงวดละ: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
            จำนวน: <b>{installmentTerms}</b> งวด <br />
            (อัตราดอกเบี้ย MRR ต่อปี)<br />
            เริ่มชำระงวดแรก วันที่ {startDateDisplay}<br />
            เสร็จสิ้นภายในวันที่ {endDateDisplay}<br />
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
    // วันหมดอายุจาก tbl_account_cus_target.expire_date (ISO string / YYYY-MM-DD) — ใช้กับแผน Haircut เท่านั้น
    expireDate: PropTypes.string,
};

InstallmentSchedule.defaultProps = {
    isHaircut: false,
    paymentAmount: 0,
    installmentTerms: 0,
    scheduledNextDate: "",
    expireDate: "",
};

export default InstallmentSchedule;
