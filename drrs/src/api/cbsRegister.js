import { apiAxiosInstance } from "./handler";
import { logger } from "utils/logger";

/**
 * ตรวจสอบข้อมูลบัญชีสินเชื่อจาก CBS (ผ่าน backend: gettoken (SSO) -> CBS Inquiry LoanAccount)
 * @param {Object} payload - { accountNo, source } — source: "select-plan" เมื่อยิงจากหน้า select-plan
 *   (แค่ prefetch อัปเดตข้อมูลล่วงหน้า ไม่ต้องบันทึกประวัติลง tbl_cbs_inquiry_account)
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
