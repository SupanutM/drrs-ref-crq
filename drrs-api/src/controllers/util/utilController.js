const UtilService = require("../../services/util/utilService");

const encryptionController = (req, res) => {
    try {
        const { value } = req.body;
        
        // ดักกรณีหน้าบ้านไม่ได้ส่งค่า value มา
        if (!value) {
            return res.status(400).json({ status_flag: false, status_message: "Value is required" });
        }

        const encryptedResult = UtilService.encryptData(value);

        return res.status(200).json({
            status_flag: true,
            status_message: "success",
            encrypted: encryptedResult
        });
    } catch (error) {
        return res.status(500).json({ status_flag: false, status_message: error.message });
    }
};

const decryptionController = (req, res) => {
    try {
        const { value } = req.body;

        if (!value) {
            return res.status(400).json({ status_flag: false, status_message: "Value is required" });
        }

        // 🌟 แก้ชื่อตัวแปรให้ถูกต้องตาม Logic (ถอดรหัส)
        const decryptedResult = UtilService.decryptData(value);

        return res.status(200).json({
            status_flag: true,
            status_message: "success",
            decrypted: decryptedResult // 🌟 เปลี่ยน key เป็น decrypted
        });
    } catch (error) {
        return res.status(500).json({ status_flag: false, status_message: error.message });
    }
};

// 🌟 ส่งออกฟังก์ชันให้ Router เอาไปใช้งาน
module.exports = {
    encryptionController,
    decryptionController
};