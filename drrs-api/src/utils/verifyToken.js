const crypto = require('crypto');
const env = require('../config/env');

function verifyToken(value) {
    if (typeof value !== 'string') return false;

    const expected = `Bearer ${env.authorization}`;
    // hash ทั้งสองฝั่งก่อน เพื่อให้ความยาวเท่ากันเสมอ (กัน timingSafeEqual โยน error
    // และกันการรั่วข้อมูลความยาวของ token)
    const a = crypto.createHash('sha256').update(value).digest();
    const b = crypto.createHash('sha256').update(expected).digest();

    return crypto.timingSafeEqual(a, b);
}

module.exports = {
    verifyToken,
};
