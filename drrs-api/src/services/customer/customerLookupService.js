const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const { AppDataSource } = require('../../config/database');
const tblMtProvince = require('../../entities/tblMtProvince');
const tblMtDistrict = require('../../entities/tblMtDistrict');
const tblMtSubDistrict = require('../../entities/tblMtSubDistrict');
const baseLogger = require('../../utils/logger');
const { systemLogService } = require('../util/systemLog/systemLogService');
const logger = baseLogger.child({ context: 'customerLookupService' });
//  * ดึงข้อมูลที่อยู่ลูกค้าจาก API ภายนอก และประกอบเป็นที่อยู่บรรทัดเดียว
//  * @param {string} customer_number - CIF No. ของลูกค้า
//  * @param {string} citizen_id - รหัสบัตรประชาชน
//  * @returns {Promise<string>} - ที่อยู่แบบเต็มบรรทัด
//  */
const getCustomerFullAddress = async (customer_number, citizen_id) => {
    let fullAddress = "";

    // ============================================================
    // 🧪 LOAD TEST MODE — ข้าม CUST Profile API จริง (ภายนอก) เพื่อ Load Test
    // ระบบภายนอก (custprofileuat.gsb.or.th) ยิงระหว่างโหลดเทสต์ไม่ได้ และทำให้
    // verify ช้า/แกว่ง (รอ timeout) — โหมดนี้ตัดออกเพื่อวัดเฉพาะแอปของเรา
    // วิธีเปิดใช้: ตั้ง LOAD_TEST_MODE=true ใน .env แล้ว restart server
    // ห้ามใช้ใน Production เด็ดขาด!
    // ============================================================
    if (process.env.LOAD_TEST_MODE === 'true') {
        logger.warn('[LOAD_TEST_MODE] ข้ามการเรียก CUST Profile API — คืนที่อยู่ว่าง');
        return "";
    }

    try {
        const CUST_API_BASE_URL = process.env.CUST_API_BASE_URL;
        const url = `${CUST_API_BASE_URL}/customer-management/v1/customers/lookup`;
        const headers = {
            "x-job-id": crypto.randomUUID(),
            "x-channel": "DRRS",
            "x-request-id": crypto.randomUUID(),
            "Content-Type": "application/json",
            "branch_code": "1",
            "terminal_id": "1"
        };
        const payload = {
            "rq_body": {
                "lookup_key": {
                    "customer_number": customer_number || "",
                    "citizen_id": citizen_id || ""
                }
            }
        };
        const httpsAgent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.post(url, payload, { headers, httpsAgent });

        if (response.data && response.data.rs_body) {
            const data = response.data;
            const addressList = data.rs_body.address_information || [];
            const addressObj = addressList.find(addr => addr.address_type === "01") || {};
            if (addressObj.address_long_lines) {
                let subDistrictName = "";
                let districtName = "";
                let provinceName = "";

                if (addressObj.province_code) {
                    const province = await AppDataSource.getRepository(tblMtProvince).findOne({
                        where: { provinceCode: addressObj.province_code, lang: 'TH' }
                    });
                    if (province) provinceName = province.provinceName;
                }

                if (addressObj.district_code && addressObj.province_code) {
                    const district = await AppDataSource.getRepository(tblMtDistrict).findOne({
                        where: { districtCode: addressObj.district_code, provinceCode: addressObj.province_code, lang: 'TH' }
                    });
                    if (district) districtName = district.districtName;
                }

                if (addressObj.sub_district_code && addressObj.district_code && addressObj.province_code) {
                    const subDistrict = await AppDataSource.getRepository(tblMtSubDistrict).findOne({
                        where: { subDistrictCode: addressObj.sub_district_code, districtCode: addressObj.district_code, provinceCode: addressObj.province_code, lang: 'TH' }
                    });
                    if (subDistrict) subDistrictName = subDistrict.subDistrictName;
                }

                let subDistPrefix = addressObj.province_code === '10' ? 'แขวง' : 'ต.';
                let distPrefix = addressObj.province_code === '10' ? 'เขต' : 'อ.';
                let provPrefix = addressObj.province_code === '10' ? '' : 'จ.';

                const parts = [
                    addressObj.address_long_lines.address1,
                    addressObj.address_long_lines.address2,
                    addressObj.address_long_lines.address3,
                    addressObj.address_long_lines.address4,
                    subDistrictName ? `${subDistPrefix}${subDistrictName}` : '',
                    districtName ? `${distPrefix}${districtName}` : '',
                    provinceName ? `${provPrefix}${provinceName}` : '',
                    addressObj.postal || addressObj.zip_code || addressObj.zipcode
                ].filter(p => p && p.trim() !== "");
                fullAddress = parts.join(" ");
            }
        }

        // audit: บันทึกว่าไปเรียก CUST360 มา — ไม่ log ที่อยู่จริง (PII) เก็บแค่ว่าเจอไหม
        await systemLogService({
            step: 'CUST360_LOOKUP',
            controller: 'customerLookupService',
            payload: { customer_number },
            responseStatus: 200,
            response: { message: 'ดึงข้อมูลที่อยู่จาก CUST360', addressFound: !!fullAddress },
            createdBy: 'system'
        }).catch((err) => logger.warn(`บันทึก audit CUST360 ไม่สำเร็จ: ${err.message}`));

    } catch (error) {
        logger.warn(`Error looking up customer address: ${error.message}`);

        // audit: บันทึกกรณีเรียก CUST360 ล้มเหลว (ไม่โยน error ต่อ — flow verify ยังไปต่อได้)
        await systemLogService({
            step: 'CUST360_LOOKUP',
            controller: 'customerLookupService',
            payload: { customer_number },
            responseStatus: 500,
            response: { message: 'เรียก CUST360 ไม่สำเร็จ', error: error.message },
            createdBy: 'system'
        }).catch((err) => logger.warn(`บันทึก audit CUST360 (error) ไม่สำเร็จ: ${err.message}`));
    }
    return fullAddress;
};

module.exports = {
    getCustomerFullAddress
};
