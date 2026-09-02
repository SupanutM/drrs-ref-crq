const axios = require('axios');
const crypto = require('crypto');
const env = require('../../config/env');
const baseLogger = require('../../utils/logger');
const { getAccessToken } = require('./getAccessTokenService');
const { systemLogService } = require('../util/systemLog/systemLogService');
const logger = baseLogger.child({ context: 'inquiryAccountService' });

/**
 * เรียก CBS Inquiry LoanAccount API (CBS_INQUIRY_ACCOUNT_URL) เพื่อตรวจสอบข้อมูลบัญชีสินเชื่อ
 * ลำดับการยิง: ขอ access token จาก SSO ก่อน (getAccessToken) แล้วแนบ Authorization Bearer ยิงต่อ
 * @param {Object} params
 * @param {string} params.accountNo - เลขที่บัญชี ใช้ map เป็น AccountNumber ใน body ของ CBS
 * @param {string} [params.planNo] - เลขที่แผนที่เลือก (tbl_mt_master_plan.code) เก็บไว้คู่กับ log (ไม่ส่งไปที่ CBS)
 * @param {string} [params.source] - แหล่งที่มาของการเรียก:
 *   "select-plan" = หน้าเลือกแผน (แค่ prefetch อัปเดตข้อมูลล่วงหน้า)
 *   "preview"     = หน้า plan-summary ก่อนกดยอมรับ (แค่โชว์ตัวอย่างสัญญาบนจอ)
 *   ทั้งสองกรณีนี้ไม่บันทึกผลลัพธ์ลง tbl_system_log — บันทึกเฉพาะตอน "ยอมรับสัญญา" จริง
 *   (ไม่ส่ง source หรือ source อื่น) กันบันทึกซ้ำหลายรอบต่อบัญชีจากการยิง inquiry ซ้ำๆ ก่อนยอมรับ
 */
const SKIP_SAVE_SOURCES = ['select-plan', 'preview'];

const inquiryAccountService = async ({ accountNo, source, planNo }) => {
    try {
        const accessToken = await getAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            app_id: env.cbsInquiryAccountAppId,
            app_key: env.cbsInquiryAccountAppKey,
        };

        // body ตาม spec ของ CBS_INQUIRY_ACCOUNT_URL (LoanAccount)
        const body = {
            ServiceName: env.cbsInquiryAccountServiceName,
            UUID: crypto.randomUUID(),
            AccountNumber: accountNo,
        };

        const response = await axios.post(env.cbsInquiryAccountUrl, body, { headers });

        // เก็บผลลัพธ์ inquiry เป็นประวัติลง tbl_system_log (เดิมเก็บที่ tbl_cbs_inquiry_account — เลิกใช้แล้ว)
        // ไม่ throw ถ้าบันทึกไม่สำเร็จ — ยกเว้นถูกเรียกมาจากหน้า select-plan/preview (แค่ดูตัวอย่าง ไม่ต้องเก็บประวัติ)
        if (!SKIP_SAVE_SOURCES.includes(source)) {
            await systemLogService({
                step: 'CBS_INQUIRY_ACCOUNT',
                controller: 'inquiryAccountService',
                payload: { accountNo, planNo },
                responseStatus: 200,
                response: { message: 'ตรวจสอบข้อมูลบัญชีสำเร็จ', cbsResponse: response.data }
            }).catch((err) => logger.error(`บันทึก audit CBS_INQUIRY_ACCOUNT ไม่สำเร็จ: ${err.message}`));
        }

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        if (error.response) {
            logger.error(`[CBS Inquiry Account] API ตอบ error: status=${error.response.status}`);
            return {
                success: false,
                message: 'ไม่สามารถตรวจสอบข้อมูลบัญชีจากระบบ CBS ได้',
                status: error.response.status,
                error: error.response.data,
            };
        }
        logger.error(`[CBS Inquiry Account] เรียก API ไม่สำเร็จ: ${error.message}`);
        return {
            success: false,
            message: 'ไม่สามารถเชื่อมต่อระบบตรวจสอบบัญชี CBS ได้',
        };
    }
};

module.exports = { inquiryAccountService };
