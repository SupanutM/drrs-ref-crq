const crypto = require("../../utils/crypto");
require("dotenv").config();

const UtilService = {
  encryptData: (value) => {
    // สุ่ม IV ใหม่ทุกครั้ง (จัดการภายใน encryptGCM) แล้วแนบ iv ไปกับผลลัพธ์
    const { iv, encrypted, tag } = crypto.encryptGCM(value, process.env.CRYPTO_KEY);
    return `${iv}:${encrypted}:${tag}`;
  },

  decryptData: (encryptedValue) => {
    return crypto.decryptGCM(
      encryptedValue,
      process.env.CRYPTO_KEY,
      process.env.CRYPTO_IV
    );
  }
};

module.exports = UtilService;