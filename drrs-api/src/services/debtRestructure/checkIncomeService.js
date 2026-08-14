const { AppDataSource } = require('../../config/database');
const baseLogger = require('../../utils/logger');
const { loadSqlQuery } = require('../../utils/sqlProvider');

const logger = baseLogger.child({ context: 'checkIncomeService' });

/**
 * checkIncomeService
 *
 * ตรวจสอบว่ารายได้สุทธิของลูกค้า (จาก DB) เพียงพอต่อการชำระหนี้ตามแผนที่เลือกหรือไม่
 *
 * Logic:
 *  1. สำหรับแต่ละ account ใน array → query DB เพื่อดึง netIncome, minAmount, isCheckIncome
 *  2. ถ้าไม่พบข้อมูลใน DB → ข้ามบัญชีนั้น (ไม่สามารถ validate ได้)
 *  3. ถ้าพบข้อมูล → ใช้ค่า netIncome จาก DB จริงๆ (แม้จะเป็น 0)
 *  4. กรองเฉพาะ account ที่ isCheckIncome !== '0'
 *  5. รวม minAmount → เปรียบเทียบ netIncome >= totalMinAmount
 *
 * @param {number|string} cusTargetId - tbl_cus_target.id
 * @param {Array<{accountNo: string, planNo: string}>} accounts - รายการบัญชีที่เลือก
 * @returns {{ isValid: boolean, netIncome: number, netIncomeFound: boolean, totalMinAmount: number, failedAccounts: string[] }}
 */
const checkIncomeService = async (cusTargetId, accounts) => {
    try {
        if (!cusTargetId || !accounts || accounts.length === 0) {
            logger.warn('[checkIncomeService] ไม่มีข้อมูล cusTargetId หรือ accounts');
            return { isValid: true, netIncome: 0, netIncomeFound: false, totalMinAmount: 0, failedAccounts: [] };
        }

        const sql = loadSqlQuery('check_income_plan.sql');

        let netIncome = 0;
        let netIncomeFound = false; // ← flag: อ่านค่า netIncome จาก DB จริงๆ หรือยัง
        let totalMinAmount = 0;
        const failedAccounts = [];

        for (const acc of accounts) {
            const rows = await AppDataSource.query(sql, [cusTargetId, acc.accountNo, acc.planNo]);

            if (!rows || rows.length === 0) {
                // ไม่มีข้อมูลใน DB สำหรับ account นี้ → ข้ามไป ไม่ถือว่าได้ set netIncome
                logger.warn(`[checkIncomeService] ไม่พบข้อมูลใน DB สำหรับ accountNo: ${acc.accountNo}, planNo: ${acc.planNo} — ข้ามการตรวจสอบ`);
                continue;
            }

            const row = rows[0];

            // อ่าน netIncome จาก DB เพียงครั้งแรก (ค่าเดียวกันทุก account เพราะ cusTargetId เดียวกัน)
            if (!netIncomeFound) {
                netIncome = Number(row.netIncome || 0);
                netIncomeFound = true;
                logger.info(`[checkIncomeService] อ่าน netIncome จาก DB: ${netIncome}`);
            }

            // isCheckIncome = '0' → ไม่ต้องเช็ค, อื่นๆ → ต้องเช็ค
            if (String(row.isCheckIncome).trim() === '0') {
                logger.info(`[checkIncomeService] accountNo: ${acc.accountNo} ไม่ต้องเช็ครายได้ (isCheckIncome=0)`);
                continue;
            }

            const minAmount = Number(row.minAmount || 0);
            totalMinAmount += minAmount;

            logger.info(`[checkIncomeService] accountNo: ${acc.accountNo} | minAmount: ${minAmount} | isCheckIncome: ${row.isCheckIncome}`);
        }

        // isValid logic:
        //   - netIncomeFound = false → ไม่มีข้อมูลใน DB → ไม่สามารถตรวจสอบได้ → ผ่าน
        //   - netIncomeFound = true  → ใช้ netIncome จาก DB จริงๆ (แม้เป็น 0) เทียบกับ totalMinAmount
        const isValid = !netIncomeFound || netIncome >= totalMinAmount;

        logger.info(`[checkIncomeService] ผลสรุป | netIncomeFound: ${netIncomeFound} | netIncome: ${netIncome} | totalMinAmount: ${totalMinAmount} | isValid: ${isValid}`);

        if (!isValid) {
            accounts.forEach(acc => failedAccounts.push(acc.accountNo));
        }

        return { isValid, netIncome, netIncomeFound, totalMinAmount, failedAccounts };

    } catch (error) {
        logger.error(`[checkIncomeService] Error: ${error.message}`);
        throw error;
    }
};

module.exports = { checkIncomeService };
