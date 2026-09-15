import { apiAxiosInstance } from "./handler";
import { logger } from "utils/logger";

/**
 * ตรวจสอบข้อมูลบัญชีสินเชื่อจาก CBS (ผ่าน backend: gettoken (SSO) -> CBS Inquiry LoanProcess)
 * @param {Object} payload - { accountNo, subMethod, installmentTerms, source }
 *   - subMethod: "SUMALL" (default, เช็ค REJECT + วงเงิน/ภาระหนี้/เงินต้น/ดอกเบี้ย) หรือ
 *     "NEXTPLN1" (เฉพาะแผนผ่อนชำระ ต้องส่ง installmentTerms เสมอ — ห้ามว่าง)
 *   - source: "select-plan" เมื่อยิงจากหน้า select-plan
 *     (แค่ prefetch อัปเดตข้อมูลล่วงหน้า ไม่ต้องบันทึกประวัติลง tbl_system_log)
 */
export const inquiryAccount = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/cbsregister/inquiry-account", payload);
        return response.data;
    } catch (error) {
        logger.error("cbsregister/inquiry-account Error:", error);
        throw error;
    }
};
