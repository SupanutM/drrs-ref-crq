const axios = require('axios');
const crypto = require('crypto');
const env = require('../../config/env');
const baseLogger = require('../../utils/logger');
const { getAccessToken } = require('./getAccessTokenService');
const logger = baseLogger.child({ context: 'registerDigitalLoanService' });

/**
 * เรียก CBS Register Digitalloan API (CBS_REGIS_DIGITALLOAN_URL) เพื่อลงทะเบียนแผนปรับโครงสร้างหนี้
 * ที่ลูกค้ายอมรับแล้วกับ CBS จริง (ยิงตอน "ยอมรับสัญญา" เท่านั้น)
 * ลำดับการยิง: ขอ access token จาก SSO ก่อน (getAccessToken) แล้วแนบ Authorization Bearer ยิงต่อ
 *
 * Field mapping ตาม spec ที่ทีม CBS ให้มา (request):
 *   ServiceName       ชื่อ sub service ภายใต้ 8002 -> ระบุเป็น "REGDTLN69"
 *   UUID              Uniq UUID key
 *   AccountNumber     เลขที่บัญชีสินเชื่อ
 *   TargetPlan        แผนที่ลงทะเบียน -> "1" = ปิดบัญชี (Haircut), "2" = ผ่อนชำระ (Installment)
 *                     (ในระบบ DRRS เก็บรหัสแผน 2 หลัก "01"/"02" ตรงกับ tbl_mt_master_plan.code
 *                      แต่ CBS ต้องการแค่ 1 หลัก "1"/"2" — ต้องแปลงก่อนส่ง)
 *   Plan1Balance      ยอดชี้เป้าของแผน 1 (ปิดบัญชี) — ถ้าเป็นแผน 2 ระบุเป็นค่าว่าง
 *   Plan1ExpireDate   วันที่กำหนดให้ระบบเปลี่ยนค่าลำดับการตัดกลับคืน รูปแบบ YYYYMMDD
 *                     — ถ้าเป็นแผน 2 ระบุเป็นค่าว่าง
 *   Plan2PaymentAmt   ยอดชี้เป้าเงินงวดของแผน 2 (ผ่อนชำระ) — ถ้าเป็นแผน 1 ระบุเป็นค่าว่าง
 *   Plan2Month        จำนวนเดือนชี้เป้าของแผน 2 -> ต้องส่งเป็น "เลขจำนวนเต็ม" (number ไม่ใช่ string)
 *                     — ถ้าเป็นแผน 1 ระบุเป็นค่าว่าง
 *
 * Field mapping ของ response ที่ CBS ตอบกลับ:
 *   ServiceName   ชื่อ sub service ภายใต้ 8002 (สะท้อนค่าที่ส่งไป)
 *   UUID          Uniq UUID key (สะท้อนค่าที่ส่งไป)
 *   AccountNumber เลขที่บัญชีสินเชื่อ
 *   TimeStamp     วันที่ประมวลผลของ CBS รูปแบบ Julian <DATE>:<TIME>
 *   Status        ผลการทำงาน -> "SUCCESS" หรือ "REJECT"
 *   Desc          คำอธิบายผลการทำงาน (Error Description) — ถ้า SUCCESS จะเป็นค่าว่าง
 *   ⚠️ CBS อาจตอบ HTTP 200 แต่ Status เป็น "REJECT" ก็ได้ — ต้องเช็ค Status ในตัว body เสมอ
 *   ไม่ใช่แค่เช็คว่า HTTP request สำเร็จหรือไม่
 *
 * @param {Object} params
 * @param {string} params.accountNo - เลขที่บัญชีสินเชื่อ
 * @param {boolean} params.isHaircut - true = แผนปิดบัญชี (TargetPlan "1"), false = แผนผ่อนชำระ (TargetPlan "2")
 * @param {number|string} [params.paymentAmount] - แผน 1: ยอดปิดบัญชี (Plan1Balance) / แผน 2: ยอดผ่อนต่องวด (Plan2PaymentAmt)
 * @param {number|string} [params.installmentTerms] - แผน 2: จำนวนงวด (เดือน) -> Plan2Month
 * @param {string} [params.scheduledNextDate] - แผน 1: วันที่ครบกำหนด (YYYYMMDD จาก CBS ScheduledNextDate) -> Plan1ExpireDate
 */
const registerDigitalLoanService = async ({ accountNo, isHaircut, paymentAmount, installmentTerms, scheduledNextDate }) => {
    try {
        const accessToken = await getAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            app_id: env.cbsRegisDigitalLoanAppId,
            app_key: env.cbsRegisDigitalLoanAppKey,
        };

        // body ตาม spec ของ CBS_REGIS_DIGITALLOAN_URL — field ของแผนที่ไม่ได้เลือกต้องส่งเป็นค่าว่าง ("")
        const body = {
            ServiceName: env.cbsRegisDigitalLoanServiceName,
            UUID: crypto.randomUUID(),
            AccountNumber: accountNo,
            // CBS ต้องการ TargetPlan แค่ 1 หลัก ("1"/"2") แม้ในระบบ DRRS จะเก็บเป็น "01"/"02"
            TargetPlan: isHaircut ? '1' : '2',
            Plan1Balance: isHaircut ? String(paymentAmount ?? '') : '',
            Plan1ExpireDate: isHaircut ? (scheduledNextDate || '') : '',
            Plan2PaymentAmt: !isHaircut ? String(paymentAmount ?? '') : '',
            // Plan2Month ต้องเป็นเลขจำนวนเต็ม (number) ไม่ใช่ string — ต่างจาก field อื่นที่เป็น string ทั้งหมด
            Plan2Month: !isHaircut ? (parseInt(installmentTerms, 10) || 0) : '',
        };

        // log payload ที่ยิงไปจริง (ไม่มีข้อมูลอ่อนไหวส่วนบุคคล มีแค่เลขบัญชี/แผน/ยอดเงิน) — ช่วย debug 400 Bad Request
        logger.info(`[CBS Register Digitalloan] payload ที่ส่งไป: ${JSON.stringify(body)}`);

        const response = await axios.post(env.cbsRegisDigitalLoanUrl, body, { headers });

        // เก็บ response ดิบที่ CBS ตอบกลับมาไว้ใน log เสมอ (ทั้งเคส SUCCESS/REJECT)
        // ไว้ตรวจสอบย้อนหลังได้ว่า CBS ตอบอะไรมาจริงๆ ต่อ 1 คำขอ (มี TimeStamp/Status/Desc ตาม spec)
        logger.info(`[CBS Register Digitalloan] response จาก CBS (account_no: ${accountNo}): ${JSON.stringify(response.data)}`);

        // CBS ตอบ HTTP 200 มาได้แม้ผลลัพธ์จริงจะ "REJECT" — ต้องเช็ค Status ในตัว body เสมอ
        const cbsStatus = String(response.data?.Status || '').toUpperCase();
        if (cbsStatus !== 'SUCCESS') {
            logger.warn(`[CBS Register Digitalloan] CBS ปฏิเสธคำขอ (account_no: ${accountNo}): ${response.data?.Desc || 'ไม่มีคำอธิบาย'}`);
            return {
                success: false,
                message: response.data?.Desc || 'CBS ปฏิเสธคำขอลงทะเบียนแผน',
                data: response.data,
            };
        }

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        if (error.response) {
            logger.error(`[CBS Register Digitalloan] API ตอบ error: status=${error.response.status} body=${JSON.stringify(error.response.data)}`);
            return {
                success: false,
                message: 'ไม่สามารถลงทะเบียนแผนปรับโครงสร้างหนี้กับ CBS ได้',
                status: error.response.status,
                error: error.response.data,
            };
        }
        logger.error(`[CBS Register Digitalloan] เรียก API ไม่สำเร็จ: ${error.message}`);
        return {
            success: false,
            message: 'ไม่สามารถเชื่อมต่อระบบลงทะเบียนแผน CBS ได้',
        };
    }
};

module.exports = { registerDigitalLoanService };
