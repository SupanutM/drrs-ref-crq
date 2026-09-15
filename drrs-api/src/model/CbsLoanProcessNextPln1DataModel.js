/**
 * Model รับผิดชอบแปลง DataOutput (string คั่นด้วย "#") ของ CBS Inquiry LoanProcess
 * (CBS_INQUIRY_ACCOUNT_URL) เฉพาะ SubMethod "NEXTPLN1" ให้เป็น Object ที่มี key ชัดเจน
 * แยก Logic การ .split('#') ออกจากไฟล์ Service ตามแนวทางใน string_to_model_mapping_guide.md
 *
 * รูปแบบ DataOutput (spec 2026-09-15): "new_schnd#new_mdt#" (ทั้งคู่รูปแบบ YYYYMMDD)
 *   new_schnd -> กำหนดชำระงวดถัดไป (ใช้กับแผนผ่อนชำระเท่านั้น)
 *   new_mdt   -> เก็บไว้เผื่อใช้ในอนาคต ไม่มีจุดใช้งานตอนนี้
 *
 * หมายเหตุ: field ที่ export ออกไปตั้งชื่อให้ตรงกับที่โค้ดเดิมใช้อยู่แล้ว (ScheduledNextDate)
 * เพื่อไม่กระทบจุดที่เรียกใช้ต่อ (contractHelper.js ฯลฯ)
 */
class CbsLoanProcessNextPln1DataModel {
    /**
     * @param {string} rawDataOutput ข้อมูลดิบจาก CBS เช่น "20261015#20261010#"
     */
    constructor(rawDataOutput) {
        if (!rawDataOutput) {
            this._setDefaultValues();
            return;
        }

        // แยกค่าด้วย "#" และตัดช่องว่างอันสุดท้ายทิ้ง (string จบด้วย "#" เสมอตาม spec)
        const [newSchnd, newMdt] = rawDataOutput.split('#').filter((item) => item !== '');

        // YYYYMMDD — ใช้ตรงๆ เป็น ScheduledNextDate ไม่คำนวณเพิ่ม (ตัดสินใจ 2026-09-15)
        this.scheduledNextDate = newSchnd || '';
        this.newMdt = newMdt || '';
    }

    _setDefaultValues() {
        this.scheduledNextDate = '';
        this.newMdt = '';
    }

    /**
     * ส่งออกเป็น field ชื่อเดิมที่ระบบใช้อยู่แล้ว เพื่อให้จุดที่เรียกใช้ (contractHelper.js)
     * ไม่ต้องแก้โค้ด
     */
    toJSON() {
        return {
            ScheduledNextDate: this.scheduledNextDate,
            NewMdt: this.newMdt,
        };
    }
}

module.exports = CbsLoanProcessNextPln1DataModel;
