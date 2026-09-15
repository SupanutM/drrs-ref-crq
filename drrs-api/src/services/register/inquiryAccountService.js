const axios = require('axios');
const crypto = require('crypto');
const env = require('../../config/env');
const baseLogger = require('../../utils/logger');
const { getAccessToken } = require('./getAccessTokenService');
const { systemLogService } = require('../util/systemLog/systemLogService');
const CbsLoanProcessSumAllDataModel = require('../../model/CbsLoanProcessSumAllDataModel');
const CbsLoanProcessNextPln1DataModel = require('../../model/CbsLoanProcessNextPln1DataModel');
const logger = baseLogger.child({ context: 'inquiryAccountService' });

/**
 * เรียก CBS Inquiry LoanProcess API (CBS_INQUIRY_ACCOUNT_URL) เพื่อตรวจสอบข้อมูลบัญชีสินเชื่อ
 * ลำดับการยิง: ขอ access token จาก SSO ก่อน (getAccessToken) แล้วแนบ Authorization Bearer ยิงต่อ
 *
 * ต้องยิงแยกตามแผนที่ต้องการข้อมูล (spec ใหม่ 2026-09-15):
 *   SubMethod: "SUMALL"   DataInput: ""            -> ใช้กับแผน Haircut (plan 1) และตอนต้องการ
 *                                                      วงเงิน/ภาระหนี้/เงินต้น/ดอกเบี้ย (ทั้ง 2 แผน)
 *   SubMethod: "NEXTPLN1" DataInput: "#<งวด>"      -> ใช้กับแผนผ่อนชำระ (plan 2) เพื่อดู
 *                                                      กำหนดชำระงวดถัดไป (ScheduledNextDate)
 *                                                      <งวด> = installment_terms ต้องมีค่าเสมอ (ห้ามว่าง)
 *
 * @param {Object} params
 * @param {string} params.accountNo - เลขที่บัญชี ใช้ map เป็น AccountNumber ใน body ของ CBS
 * @param {string} [params.subMethod] - "SUMALL" (default) หรือ "NEXTPLN1"
 * @param {string|number} [params.installmentTerms] - จำนวนงวดผ่อน ใช้ประกอบ DataInput เมื่อ subMethod = "NEXTPLN1" เท่านั้น
 * @param {string} [params.planNo] - เลขที่แผนที่เลือก (tbl_mt_master_plan.code) เก็บไว้คู่กับ log (ไม่ส่งไปที่ CBS)
 * @param {string} [params.source] - แหล่งที่มาของการเรียก:
 *   "select-plan" = หน้าเลือกแผน (แค่ prefetch อัปเดตข้อมูลล่วงหน้า)
 *   "preview"     = หน้า plan-summary ก่อนกดยอมรับ (แค่โชว์ตัวอย่างสัญญาบนจอ)
 *   ทั้งสองกรณีนี้ไม่บันทึกผลลัพธ์ลง tbl_system_log — บันทึกเฉพาะตอน "ยอมรับสัญญา" จริง
 *   (ไม่ส่ง source หรือ source อื่น) กันบันทึกซ้ำหลายรอบต่อบัญชีจากการยิง inquiry ซ้ำๆ ก่อนยอมรับ
 */
const SKIP_SAVE_SOURCES = ['select-plan', 'preview'];

const inquiryAccountService = async ({ accountNo, subMethod, installmentTerms, source, planNo }) => {
    try {
        // NEXTPLN1 (แผนผ่อนชำระ) ต้องมีจำนวนงวดเสมอ ห้ามส่งค่าว่างไปที่ CBS
        if (subMethod === 'NEXTPLN1' && (installmentTerms === undefined || installmentTerms === null || installmentTerms === '')) {
            throw new Error('installmentTerms ต้องไม่เป็นค่าว่างเมื่อ subMethod เป็น NEXTPLN1');
        }

        const finalSubMethod = subMethod === 'NEXTPLN1' ? 'NEXTPLN1' : 'SUMALL';
        const dataInput = finalSubMethod === 'NEXTPLN1' ? `${installmentTerms}#` : '';

        const accessToken = await getAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            app_id: env.cbsInquiryAccountAppId,
            app_key: env.cbsInquiryAccountAppKey,
        };

        // body ตาม spec ของ CBS_INQUIRY_ACCOUNT_URL (LoanProcess) — ไม่มี ServiceName แล้ว
        const body = {
            UUID: crypto.randomUUID(),
            AccountNumber: accountNo,
            SubMethod: finalSubMethod,
            DataInput: dataInput,
        };

        const response = await axios.post(env.cbsInquiryAccountUrl, body, { headers });

        // CBS ตอบ HTTP 200 มาได้แม้ Status เป็น "REJECT" — เช็ค Status ในตัว body เสมอ
        const cbsStatus = String(response.data?.Status || '').toUpperCase();
        // แปลง DataOutput (คั่นด้วย "#") ผ่าน Model เฉพาะทางตาม SubMethod
        // (ดู src/model/CbsLoanProcessSumAllDataModel.js และ src/model/CbsLoanProcessNextPln1DataModel.js)
        // แล้วรวมเข้ากับ response ดิบ ให้ผู้เรียกเดิม (contractHelper.js) ใช้ field ชื่อเดิมได้ต่อ
        let parsedFields = {};
        if (cbsStatus === 'SUCCESS') {
            parsedFields = finalSubMethod === 'NEXTPLN1'
                ? new CbsLoanProcessNextPln1DataModel(response.data?.DataOutput).toJSON()
                : new CbsLoanProcessSumAllDataModel(response.data?.DataOutput).toJSON();
        }
        const resultData = { ...response.data, ...parsedFields };

        // เก็บผลลัพธ์ inquiry เป็นประวัติลง tbl_system_log (เดิมเก็บที่ tbl_cbs_inquiry_account — เลิกใช้แล้ว)
        // ไม่ throw ถ้าบันทึกไม่สำเร็จ — ยกเว้นถูกเรียกมาจากหน้า select-plan/preview (แค่ดูตัวอย่าง ไม่ต้องเก็บประวัติ)
        if (!SKIP_SAVE_SOURCES.includes(source)) {
            await systemLogService({
                step: 'CBS_INQUIRY_ACCOUNT',
                controller: 'inquiryAccountService',
                payload: { accountNo, planNo, subMethod: finalSubMethod },
                responseStatus: 200,
                response: { message: 'ตรวจสอบข้อมูลบัญชีสำเร็จ', cbsResponse: response.data }
            }).catch((err) => logger.error(`บันทึก audit CBS_INQUIRY_ACCOUNT ไม่สำเร็จ: ${err.message}`));
        }

        if (cbsStatus !== 'SUCCESS') {
            logger.warn(`[CBS Inquiry LoanProcess] CBS ปฏิเสธคำขอ (account_no: ${accountNo}, subMethod: ${finalSubMethod}): ${response.data?.Desc || 'ไม่มีคำอธิบาย'}`);
        }

        // success: true เสมอเมื่อเรียก CBS สำเร็จ (HTTP เรียกไม่ throw) ไม่ว่า Status จะเป็น
        // SUCCESS หรือ REJECT ก็ตาม — เพราะ CBS "ทำงานได้ปกติ" แค่ผลลัพธ์คือปฏิเสธคำขอ ให้
        // resultData.Status/Desc ไว้ให้ผู้เรียกเช็คเอง (สำคัญ: ถ้า return success:false ตรงนี้
        // controller จะตอบ HTTP non-2xx กลับไป ทำให้ axios ฝั่งผู้เรียก throw error แทนที่จะเข้า
        // .then() ปกติ — พังกับทุกจุดที่ต้องเช็ค Status ใน body ตามที่ระบบออกแบบไว้)
        return {
            success: true,
            data: resultData,
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
