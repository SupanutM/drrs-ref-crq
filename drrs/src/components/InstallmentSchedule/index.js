import React from "react";
import PropTypes from "prop-types";

import { calculateInstallmentSchedule, formatThaiDate } from "utils/day";

/**
 * InstallmentSchedule
 *
 * Shared component คำนวณ/แสดงกำหนดการชำระหนี้ ใช้ร่วมกันทั้งแผนผ่อนชำระ (LT) และแผนปิดบัญชี (Haircut/HC)
 * อ้างอิงวันที่ทั้งหมดจาก ScheduledNextDate (CBS Inquiry Account) เป็นวันเริ่มต้น:
 *   - Haircut      -> "ภายในวันที่" = ScheduledNextDate
 *   - ผ่อนชำระ (LT) -> "เริ่มชำระงวดแรก วันที่" = ScheduledNextDate
 *                      "เสร็จสิ้นภายในวันที่" = ScheduledNextDate + installmentTerms เดือน
 *                      (installmentTerms มาจาก tbl_account_cus_target.installment_terms)
 */
function InstallmentSchedule({ isHaircut, paymentAmount, installmentTerms, scheduledNextDate }) {
    const { startDate, endDate } = calculateInstallmentSchedule(scheduledNextDate, installmentTerms);
    const startDateDisplay = formatThaiDate(startDate);
    const endDateDisplay = formatThaiDate(endDate);

    if (isHaircut) {
        return (
            <>
                แสดงยอดหนี้ปิดบัญชี: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
                ภายในวันที่ {startDateDisplay}
            </>
        );
    }

    return (
        <>
            ผ่อนชำระงวดละ: <b>{Number(paymentAmount).toLocaleString()}</b> บาท<br />
            จำนวน: <b>{installmentTerms}</b> งวด <br />
            (อัตราดอกเบี้ย MRR ต่อปี)<br />
            เริ่มชำระงวดแรก วันที่ {startDateDisplay}<br />
            เสร็จสิ้นภายในวันที่ {endDateDisplay}<br />
            โดยท่านตกลงชำระหนี้ให้ธนาคารทั้งหมดในงวดสุดท้าย
        </>
    );
}

InstallmentSchedule.propTypes = {
    isHaircut: PropTypes.bool,
    paymentAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    installmentTerms: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    // วันที่ดิบจาก CBS (ScheduledNextDate) รูปแบบ YYYYMMDD
    scheduledNextDate: PropTypes.string,
};

InstallmentSchedule.defaultProps = {
    isHaircut: false,
    paymentAmount: 0,
    installmentTerms: 0,
    scheduledNextDate: "",
};

export default InstallmentSchedule;
