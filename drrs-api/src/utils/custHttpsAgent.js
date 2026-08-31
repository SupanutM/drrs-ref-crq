const fs = require('fs');
const https = require('https');
const path = require('path');
const env = require('../config/env');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'custHttpsAgent' });

/**
 * HTTPS agent ที่ใช้ยิงระบบภายนอก CUST360 (customer-profile) — ใช้ร่วมกันทุกจุด
 * ที่เรียก CUST360 (customerLookupService, customerController) จะได้ไม่มี 2 มาตรฐาน
 *
 * path ของไฟล์ cert ต้องตั้งไว้ที่ env CUST_CA_CERT_PATH เสมอ — ไม่มีการเดา path/ชื่อ
 * ไฟล์ default ในโค้ด (เคยมีแล้วพัง เพราะชื่อไฟล์จริงบน UAT ไม่ตรงกับที่เดาไว้)
 *
 * รับได้ทั้ง path เดียวหรือหลาย path คั่นด้วย comma เช่น
 *   CUST_CA_CERT_PATH=./certs/GSB.or.th.crt,./certs/intermediate_GSB.crt
 * (ไม่ต้อง merge ไฟล์เป็น bundle เดียวเอง — Node's https.Agent({ ca: [...] })
 *  รับ cert หลายไฟล์เป็น array ได้อยู่แล้ว อ่านแยกไฟล์ตรงๆ นี่แหละ)
 *
 * รองรับ 2 ประเภทไฟล์ ตามนามสกุล:
 *   - .p12 / .pfx  (PKCS#12, มี cert+key รวมกัน) -> ใช้ pfx + passphrase (รองรับ path เดียว)
 *     ต้องตั้ง env CUST_CERT_PASSPHRASE คู่กันด้วย
 *   - .pem / .cer / .crt (cert เปล่า)             -> ใช้ ca (รองรับหลาย path พร้อมกัน)
 *
 * พฤติกรรม (fail-closed ทุกกรณี ทุก environment):
 *   1. ไม่ได้ตั้ง CUST_CA_CERT_PATH ใน .env เลย       -> throw ทันที ไม่รันต่อ
 *   2. ตั้งไว้แล้วแต่หาไฟล์ไม่เจอ / อ่านไม่ได้ (ไฟล์ใดไฟล์หนึ่งในลิสต์) -> throw ทันที
 *   3. เป็น .p12/.pfx แต่ไม่ได้ตั้ง CUST_CERT_PASSPHRASE -> throw ทันที ไม่รันต่อ
 *   4. อ่าน/ถอดรหัสได้ครบ -> ตรวจสอบใบรับรอง server จริง (rejectUnauthorized: true)
 *      cache agent ไว้ตลอดอายุ process (ไม่อ่านดิสก์ซ้ำทุก request)
 *
 * ไม่มี fallback ไปโหมดไม่ตรวจใบรับรอง (rejectUnauthorized: false) อีกแล้ว —
 * ถ้า cert ไม่พร้อม ต้องแก้ .env ให้ถูกก่อน ไม่ใช่ปล่อยให้ระบบรันแบบไม่ปลอดภัยเงียบๆ
 */

let secureAgent = null;

const getCustHttpsAgent = () => {
    if (secureAgent) return secureAgent;

    const rawPath = env.custCaCertPath;

    if (!rawPath) {
        logger.error('[CUST360] ไม่ได้ตั้ง CUST_CA_CERT_PATH ใน .env — ต้องระบุ path ไฟล์ cert ก่อนเรียก CUST360');
        throw new Error('CUST360 cert ยังไม่ได้ตั้งค่า — ใส่ CUST_CA_CERT_PATH ใน .env');
    }

    // รองรับหลาย path คั่นด้วย comma (เช่น root cert + intermediate cert คนละไฟล์)
    const caPaths = rawPath.split(',').map((p) => p.trim()).filter(Boolean);

    for (const p of caPaths) {
        if (!fs.existsSync(p)) {
            logger.error(`[CUST360] ตั้ง CUST_CA_CERT_PATH ไว้ (${p}) แต่ไม่พบไฟล์`);
            throw new Error(`CUST360 cert ไม่พบตาม path ที่ตั้งไว้ (${p})`);
        }
    }

    const ext = path.extname(caPaths[0]).toLowerCase();
    const isPkcs12 = ext === '.p12' || ext === '.pfx';

    if (isPkcs12 && !env.custCertPassphrase) {
        logger.error(`[CUST360] ไฟล์ ${caPaths[0]} เป็น PKCS#12 (.p12/.pfx) แต่ไม่ได้ตั้ง CUST_CERT_PASSPHRASE ใน .env`);
        throw new Error('CUST360 cert เป็น .p12/.pfx ต้องตั้ง CUST_CERT_PASSPHRASE คู่กันด้วย');
    }

    try {
        const agentOptions = isPkcs12
            ? { pfx: fs.readFileSync(caPaths[0]), passphrase: env.custCertPassphrase, rejectUnauthorized: true }
            // อ่านทุกไฟล์ในลิสต์แยกกัน ส่งเป็น array ให้ ca — Node ไล่ตรวจ chain จากทุกตัวที่ให้มา
            : { ca: caPaths.map((p) => fs.readFileSync(p)), rejectUnauthorized: true };

        secureAgent = new https.Agent(agentOptions);
        logger.info(`[CUST360] โหลด cert แล้ว (${caPaths.join(', ')}, ${isPkcs12 ? 'PKCS#12' : 'PEM'}) — เปิดตรวจสอบใบรับรอง server`);
        return secureAgent;
    } catch (err) {
        logger.error(`[CUST360] พบไฟล์ cert (${caPaths.join(', ')}) แต่อ่าน/ใช้งานไม่ได้: ${err.message}`);
        throw new Error(`CUST360 cert ใช้งานไม่ได้ (${caPaths.join(', ')}): ${err.message}`);
    }
};

module.exports = { getCustHttpsAgent };
