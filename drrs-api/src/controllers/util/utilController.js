const UtilService = require("../../services/util/utilService");

const encryptionController = (req, res) => {
    try {
        const { value, values } = req.body;

        // โหมดใหม่: เข้ารหัสหลาย field ในคำขอเดียว
        // ส่ง values เป็น object เช่น { citizenId: "...", name: "...", ... }
        // เดิมหน้าบ้านต้องยิงแยกทีละ field (6 request ต่อ verify) รวมเป็น 1 request
        // ค่า field ไหนเป็นค่าว่าง/undefined จะข้าม ไม่เข้ารหัส (คืน "" ให้ตรงตำแหน่ง)
        if (values && typeof values === "object") {
            const keys = Object.keys(values);
            if (keys.length === 0) {
                return res.status(400).json({ status_flag: false, status_message: "values is empty" });
            }

            const encrypted = {};
            for (const key of keys) {
                const v = values[key];
                encrypted[key] = (v === undefined || v === null || v === "")
                    ? ""
                    : UtilService.encryptData(v);
            }

            return res.status(200).json({
                status_flag: true,
                status_message: "success",
                encrypted
            });
        }

        // โหมดเดิม: เข้ารหัส field เดียว (คงไว้เพื่อความเข้ากันได้กับโค้ดเดิมที่ยังเรียกแบบนี้)
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

// 🌟 ส่งออกฟังก์ชันให้ Router เอาไปใช้งาน
// decryptionController ถูกถอดออก: ไม่เปิด decryption endpoint สาธารณะอีกต่อไป
module.exports = {
    encryptionController
};