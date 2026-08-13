const crypto = require("crypto");

function encryptGCM(data, key, iv) {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return { encrypted, tag };
}

function decryptGCM(encryptedWithTag, key, iv) {
    const [encrypted, tag] = encryptedWithTag.split(":");
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
