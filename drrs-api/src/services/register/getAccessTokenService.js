const axios = require('axios');
const querystring = require('querystring');
const env = require('../../config/env');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'getAccessTokenService' });

// cache access token ไว้ใน memory ของ process จนกว่าจะหมดอายุ
// ลดจำนวนครั้งที่ต้องยิง SSO ซ้ำทุก request (SSO มักจำกัด rate การขอ token)
// หมายเหตุ: cache นี้อยู่ต่อ 1 process เท่านั้น ถ้ารันหลาย instance
// แต่ละ instance จะขอ token ของตัวเองแยกกัน (ยอมรับได้ ไม่ต้องแชร์ระหว่าง instance)
let cachedToken = null;
let cachedExpiresAt = 0; // epoch ms

// in-flight lock — กันหลาย request ที่เข้ามา "พร้อมกัน" ตอน token หมดอายุ ยิงขอ SSO ซ้ำกันคนละใบ
// (เช่น หน้า select-plan ยิง inquiry หลายบัญชีพร้อมกัน ถ้าไม่มี lock นี้ ทุก request ที่เห็นว่า token
// หมดอายุพร้อมกันจะยิง POST ไป SSO ซ้ำคนละรอบ ทำให้ network round-trip ไป SSO ทวีคูณตามจำนวนบัญชี)
// เก็บ Promise ของการขอ token ที่กำลังทำอยู่ไว้ตรงนี้ — request อื่นที่เข้ามาตอนนี้จะ await Promise
// เดียวกันแทนการยิงซ้ำ เคลียร์เป็น null ทันทีที่ request จบ (ไม่ว่าสำเร็จหรือ error)
let pendingTokenRequest = null;

// ขอ token ใหม่ก่อนหมดอายุจริงเล็กน้อย ป้องกัน clock skew และคำขอที่ยิงคาบเกี่ยวจังหวะหมดอายุ
const EXPIRY_BUFFER_MS = 30 * 1000;
// ถ้า SSO ไม่ส่ง expires_in มา ให้ fallback สั้นๆ (วินาที) กัน cache ยาวเกินจริงโดยไม่มีมูล
const FALLBACK_TTL_SEC = 60;

/**
 * ยิง POST ขอ access token ใหม่จาก SSO จริง (แยกออกมาจาก getAccessToken เพื่อให้ pendingTokenRequest
 * เก็บ Promise ของฟังก์ชันนี้ตรงๆ ได้ — ผู้เรียกคนอื่นที่เข้ามาตอน token หมดอายุพร้อมกันจะ await
 * Promise เดียวกันนี้ ไม่ยิง POST ซ้ำ)
 * @returns {Promise<string>} access_token
 */
const requestNewToken = async () => {
    const now = Date.now();

    try {
        const body = querystring.stringify({
            grant_type: 'client_credentials',
            client_id: env.getAccessTokenClientId,
            client_secret: env.getAccessTokenClientSecret,
        });

        const response = await axios.post(env.getAccessTokenUrl, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, expires_in } = response.data || {};

        if (!access_token) {
            throw new Error('SSO ไม่ส่ง access_token กลับมาในผลตอบรับ');
        }

        const ttlSec = Number(expires_in) > 0 ? Number(expires_in) : FALLBACK_TTL_SEC;
        cachedToken = access_token;
        cachedExpiresAt = now + ttlSec * 1000 - EXPIRY_BUFFER_MS;

        logger.info(`[SSO] ขอ access token สำเร็จ (หมดอายุใน ${ttlSec} วินาที)`);
        return cachedToken;
    } catch (error) {
        // เคลียร์ cache กันใช้ token เก่าที่อาจใช้งานไม่ได้ต่อ
        cachedToken = null;
        cachedExpiresAt = 0;

        if (error.response) {
            logger.error(`[SSO] ขอ access token ไม่สำเร็จ: status=${error.response.status}`);
        } else {
            logger.error(`[SSO] ขอ access token ไม่สำเร็จ: ${error.message}`);
        }
        throw new Error('ไม่สามารถขอ access token จากระบบ SSO ได้');
    }
};

/**
 * ขอ access token จาก SSO (GET_ACCESS_TOKEN_URL) ด้วย grant_type=client_credentials
 * คืน token จาก cache ถ้ายังไม่หมดอายุ ไม่งั้นขอใบใหม่ — ถ้ามีคำขอใบใหม่กำลังทำอยู่แล้ว
 * (จาก request อื่นที่เข้ามาพร้อมกัน) จะรอใช้ผลลัพธ์เดียวกันแทนการยิง SSO ซ้ำ
 * @returns {Promise<string>} access_token
 */
const getAccessToken = async () => {
    const now = Date.now();

    if (cachedToken && now < cachedExpiresAt) {
        return cachedToken;
    }

    // มีคำขอ token ใหม่กำลังทำอยู่แล้ว (เช่น request อื่นที่ถึงจุดนี้ก่อนเสี้ยววินาที) — รอ Promise
    // เดียวกันแทนยิง SSO ซ้ำ ทุก caller ที่ await พร้อมกันจะได้ token ใบเดียวกัน
    if (pendingTokenRequest) {
        return pendingTokenRequest;
    }

    pendingTokenRequest = requestNewToken().finally(() => {
        pendingTokenRequest = null;
    });

    return pendingTokenRequest;
};

module.exports = { getAccessToken };
