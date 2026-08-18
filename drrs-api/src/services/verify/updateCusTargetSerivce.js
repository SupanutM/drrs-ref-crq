const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'updateCusTargetService' });
const crypto = require('../../utils/crypto');

/**
 * updateCusTargetService
 * 
 * อัปเดตข้อมูลระดับลูกค้าใน tbl_cus_target
 * 
 * @param {number|string} cusTargetId - tbl_cus_target.id (ได้มาจาก verify-register response)
 * @param {object} payloadInput - ข้อมูลที่ต้องการอัปเดต
 */
const updateCusTargetService = async (cusTargetId, payloadInput) => {
    try {
        if (!cusTargetId) {
            logger.warn('ไม่พบ cusTargetId สำหรับอัปเดตข้อมูลใน tbl_cus_target');
            return {
                success: false,
                message: 'ไม่พบ cusTargetId สำหรับอัปเดตข้อมูล'
            };
        }

        const data = typeof payloadInput === 'string' ? { email: payloadInput } : (payloadInput || {});
        const { email, totalIncome, otherIncome, totalCost, netIncome, dateOfBirth, telNo, address } = data;

        const tblCusTargetRepo = AppDataSource.getRepository(tblCusTarget);

        const updateFields = {
            updateDate: new Date(),
            updateBy: 'drrs-app'
        };

        // ตรวจสอบว่า email key ถูกส่งมาใน payload หรือเปล่า (ไม่ใช่แค่ค่าเป็น null)
        // 'email' in data = true  → ส่งมาตั้งใจ (แม้จะเป็น null/empty) → update email (null = clear)
        // 'email' in data = false → ไม่ได้ส่งมาเลย (เช่น income update) → ไม่แตะ email ใน DB
        if ('email' in data) {
            if (email && typeof email === 'string' && email.trim() !== '') {
                const emailDecrypted = crypto.decryptGCM(email, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
                updateFields.email = emailDecrypted;
            } else {
                // ส่งมาเป็น null, undefined, หรือ "" → clear email ใน DB
                updateFields.email = null;
            }
        }
        // ถ้าไม่มี 'email' key ใน payload เลย → ไม่เพิ่ม email ใน updateFields → DB ไม่ถูกแตะ

        if ('telNo' in data) {
            if (telNo && typeof telNo === 'string' && telNo.trim() !== '') {
                const telNoDecrypted = crypto.decryptGCM(telNo, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
                updateFields.telNo = telNoDecrypted;
            } else {
                updateFields.telNo = null;
            }
        }

        // Overwrite old values with new ones. If null/empty, set to 0 to clear old values.
        if (totalIncome !== undefined) {
            updateFields.totalIncome = totalIncome === "" || totalIncome === null ? 0 : Number(totalIncome);
        }
        if (otherIncome !== undefined) {
            updateFields.otherIncome = otherIncome === "" || otherIncome === null ? 0 : Number(otherIncome);
        }
        if (totalCost !== undefined) {
            updateFields.totalCost = totalCost === "" || totalCost === null ? 0 : Number(totalCost);
        }
        if (netIncome !== undefined) {
            updateFields.netIncome = netIncome === "" || netIncome === null ? 0 : Number(netIncome);
        }
        if (dateOfBirth) {
            updateFields.birthday = dateOfBirth;
        }
        if (address !== undefined) {
            updateFields.address = address;
        }

        // Note: planNo is NOT cleared on income update (DB column plan_no is NOT NULL)

        logger.info(`กำลังอัปเดตข้อมูลสำหรับ cusTargetId: ${cusTargetId} ด้วยข้อมูล: ${JSON.stringify(updateFields)}`);

        // อัปเดต tbl_cus_target โดยตรงด้วย id — ไม่ต้อง lookup ผ่านตารางอื่น
        const updateResult = await tblCusTargetRepo.update(
            { id: Number(cusTargetId) },
            updateFields
        );

        logger.info(`อัปเดตด้วย cusTargetId: ${cusTargetId} — affected: ${updateResult.affected}`);

        if (!updateResult.affected || updateResult.affected === 0) {
            logger.warn(`ไม่พบข้อมูลใน tbl_cus_target สำหรับ cusTargetId: ${cusTargetId}`);
            return {
                success: false,
                message: 'ไม่พบข้อมูลลูกค้าสำหรับอัปเดต'
            };
        }

        return {
            success: true,
            message: 'อัปเดตข้อมูลใน tbl_cus_target สำเร็จ',
            data: updateResult
        };
    } catch (error) {
        logger.error(`Error updating data in tbl_cus_target: ${error.message}`);
        throw error;
    }
};

module.exports = {
    updateCusTargetService
};
