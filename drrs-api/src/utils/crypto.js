const crypto = require("crypto");

// ความยาว IV มาตรฐานสำหรับ AES-GCM (12 ไบต์)
const IV_LENGTH = 12;

/**
 * เข้ารหัสด้วย AES-256-GCM
 * สุ่ม IV ใหม่ทุกครั้ง (สำคัญ: ห้ามใช้ IV ซ้ำใน GCM) แล้วส่ง iv กลับไปแนบกับ ciphertext
 * รูปแบบผลลัพธ์ใหม่: iv:encrypted:tag (ทุกส่วนเป็น hex)
 */
function encryptGCM(data, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return { iv: iv.toString("hex"), encrypted, tag };
}

/**
 * ถอดรหัส AES-256-GCM — รองรับ 2 รูปแบบเพื่อความเข้ากันได้ตอน deploy
 *   - ใหม่ (3 ส่วน): ivHex:encrypted:tag  → อ่าน IV จากในข้อความ
 *   - เก่า (2 ส่วน): encrypted:tag        → ใช้ legacyIv (IV คงที่เดิมจาก env) เป็น fallback
 *
 * @param {string} encryptedWithTag - ค่าที่เข้ารหัสแล้ว
 * @param {string|Buffer} key
 * @param {string|Buffer} legacyIv - IV เดิม ใช้เฉพาะกรณีข้อมูลรูปแบบเก่า (2 ส่วน)
 */
function decryptGCM(encryptedWithTag, key, legacyIv) {
    const parts = encryptedWithTag.split(":");

    let iv, encrypted, tag;
    if (parts.length === 3) {
        iv = Buffer.from(parts[0], "hex");
        encrypted = parts[1];
        tag = parts[2];
    } else {
        iv = legacyIv;
        encrypted = parts[0];
        tag = parts[1];
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

module.exports = {
    encryptGCM,
    decryptGCM,
};
