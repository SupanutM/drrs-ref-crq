const fs = require('fs');
const https = require('https');
const env = require('../config/env');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'custHttpsAgent' });

/**
 * HTTPS agent ที่ใช้ยิงระบบภายนอก CUST360 (customer-profile) — ใช้ร่วมกันทุกจุด
 * ที่เรียก CUST360 (customerLookupService, customerController) จะได้ไม่มี 2 มาตรฐาน
 *
 * path ของ CA cert ต้องตั้งไว้ที่ env CUST_CA_CERT_PATH เสมอ — ไม่มีการเดา path/ชื่อ
 * ไฟล์ default ในโค้ด (เคยมีแล้วพัง เพราะชื่อไฟล์จริงบน UAT ไม่ตรงกับที่เดาไว้)
 *
 * พฤติกรรม (fail-closed ทุกกรณี ทุก environment):
 *   1. ไม่ได้ตั้ง CUST_CA_CERT_PATH ใน .env เลย -> throw ทันที ไม่รันต่อ
 *   2. ตั้งไว้แล้วแต่หาไฟล์ไม่เจอ / อ่านไม่ได้    -> throw ทันที ไม่รันต่อ
 *   3. อ่านได้ -> ตรวจสอบใบรับรอง server จริง (rejectUnauthorized: true)
 *      cache agent ไว้ตลอดอายุ process (ไม่อ่านดิสก์ซ้ำทุก request)
 *
 * ไม่มี fallback ไปโหมดไม่ตรวจใบรับรอง (rejectUnauthorized: false) อีกแล้ว —
 * ถ้า cert ไม่พร้อม ต้องแก้ .env ให้ถูกก่อน ไม่ใช่ปล่อยให้ระบบรันแบบไม่ปลอดภัยเงียบๆ
 */

let secureAgent = null;

const getCustHttpsAgent = () => {
    if (secureAgent) return secureAgent;

    const caPath = env.custCaCertPath;

    if (!caPath) {
        logger.error('[CUST360] ไม่ได้ตั้ง CUST_CA_CERT_PATH ใน .env — ต้องระบุ path ไฟล์ CA cert ก่อนเรียก CUST360');
        throw new Error('CUST360 CA cert ยังไม่ได้ตั้งค่า — ใส่ CUST_CA_CERT_PATH ใน .env');
    }

    if (!fs.existsSync(caPath)) {
        logger.error(`[CUST360] ตั้ง CUST_CA_CERT_PATH ไว้ (${caPath}) แต่ไม่พบไฟล์`);
        throw new Error(`CUST360 CA cert ไม่พบตาม path ที่ตั้งไว้ (${caPath})`);
    }

    try {
        const ca = fs.readFileSync(caPath);
        secureAgent = new https.Agent({ ca, rejectUnauthorized: true });
        logger.info(`[CUST360] โหลด CA cert แล้ว (${caPath}) — เปิดตรวจสอบใบรับรอง server`);
        return secureAgent;
    } catch (err) {
        logger.error(`[CUST360] พบไฟล์ CA cert (${caPath}) แต่อ่าน/ใช้งานไม่ได้: ${err.message}`);
        throw new Error(`CUST360 CA cert ใช้งานไม่ได้ (${caPath}): ${err.message}`);
    }
};

module.exports = { getCustHttpsAgent };
