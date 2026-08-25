const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * ออก session token (JWT) หลังยืนยันตัวตนสำเร็จ
 * payload ควรมีอย่างน้อย { cusTargetId, accountNos }
 */
function signSession(payload) {
    return jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
}

/**
 * ตรวจสอบ session token — คืน payload ถ้าถูกต้อง, โยน error ถ้าไม่ผ่าน/หมดอายุ
 */
function verifySession(token) {
    return jwt.verify(token, env.jwtSecret);
}

module.exports = {
    signSession,
    verifySession,
};
