/**
 * Model รับผิดชอบแปลง DataOutput (string คั่นด้วย "#") ของ CBS Inquiry LoanProcess
 * (CBS_INQUIRY_ACCOUNT_URL) เฉพาะ SubMethod "SUMALL" ให้เป็น Object ที่มี key ชัดเจน
 * แยก Logic การ .split('#') ออกจากไฟล์ Service ตามแนวทางใน string_to_model_mapping_guide.md
 *
 * รูปแบบ DataOutput (spec 2026-09-15): "crlmt#total_amount#total_bal#total_int#"
 *   crlmt        -> วงเงินกู้
 *   total_amount -> ภาระหนี้คงเหลือ
 *   total_bal    -> เงินต้น
 *   total_int    -> ดอกเบี้ย
 *
 * หมายเหตุ: field ที่ export ออกไปตั้งชื่อให้ตรงกับที่โค้ดเดิมใช้อยู่แล้ว (CreditLimit/TotalAmount/
 * Balance/AccrueInterest) เพื่อไม่กระทบจุดที่เรียกใช้ต่อ (contractHelper.js ฯลฯ)
 */
class CbsLoanProcessSumAllDataModel {
    /**
     * @param {string} rawDataOutput ข้อมูลดิบจาก CBS เช่น "500000.00#480000.00#450000.00#30000.00#"
     */
    constructor(rawDataOutput) {
        if (!rawDataOutput) {
            this._setDefaultValues();
            return;
        }

        // แยกค่าด้วย "#" และตัดช่องว่างอันสุดท้ายทิ้ง (string จบด้วย "#" เสมอตาม spec)
        const [crlmt, totalAmount, totalBal, totalInt] = rawDataOutput.split('#').filter((item) => item !== '');

        this.creditLimit = crlmt || '';
        this.totalAmount = totalAmount || '';
        this.totalBalance = totalBal || '';
        this.accrueInterest = totalInt || '';
    }

    _setDefaultValues() {
        this.creditLimit = '';
        this.totalAmount = '';
        this.totalBalance = '';
        this.accrueInterest = '';
    }

    /**
     * ส่งออกเป็น field ชื่อเดิมที่ระบบใช้อยู่แล้ว (ตาม PascalCase ของ field ฝั่ง CBS เดิม)
     * เพื่อให้จุดที่เรียกใช้ (contractHelper.js) ไม่ต้องแก้โค้ด
     */
    toJSON() {
        return {
            CreditLimit: this.creditLimit,
            TotalAmount: this.totalAmount,
            Balance: this.totalBalance,
            AccrueInterest: this.accrueInterest,
        };
    }
}

module.exports = CbsLoanProcessSumAllDataModel;
