const crypto = require("../../utils/crypto");
require("dotenv").config();

const UtilService = {
  encryptData: (value) => {
    const { encrypted, tag } = crypto.encryptGCM(
      value,
      process.env.CRYPTO_KEY,
      process.env.CRYPTO_IV
    );
    return `${encrypted}:${tag}`;
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