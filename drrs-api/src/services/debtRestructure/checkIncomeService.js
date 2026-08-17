const { AppDataSource } = require('../../config/database');
const baseLogger = require('../../utils/logger');
const tblCusTarget = require('../../entities/tblCusTarget');
const tblAccountCusTarget = require('../../entities/tblAccountCusTarget');
const tblMtMasterPlan = require('../../entities/tblMtMasterPlan');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
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



        let netIncome = 0;
        let netIncomeFound = false; // ← flag: อ่านค่า netIncome จาก DB จริงๆ หรือยัง
        let totalMinAmount = 0;
        const failedAccounts = [];

        for (const acc of accounts) {
            const row = await AppDataSource.getRepository(tblCusTarget)
                .createQueryBuilder('ct')
                .select('ct.net_income', 'netIncome')
                .addSelect('act.min_amount', 'minAmount')
                .addSelect(`COALESCE(mmp.is_check_income, '1')`, 'isCheckIncome')
                .innerJoin(tblAccountCusTarget, 'act', 'act.cus_target_id = ct.id AND act.account_no = :accountNo AND act.plan_no = :planNo AND act.status = \'1\'')
                .leftJoin(tblMtMasterPlan, 'mmp', 'mmp.code = act.plan_no AND mmp.status = \'1\'')
                .where('ct.id = :cusTargetId', { cusTargetId: cusTargetId })
                .setParameters({ accountNo: acc.accountNo, planNo: acc.planNo })
                .getRawOne();

            if (!row) {
                // ไม่มีข้อมูลใน DB สำหรับ account นี้ → ข้ามไป ไม่ถือว่าได้ set netIncome
                logger.warn(`[checkIncomeService] ไม่พบข้อมูลใน DB สำหรับ accountNo: ${acc.accountNo}, planNo: ${acc.planNo} — ข้ามการตรวจสอบ`);
                continue;
            }

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

        // เช็คว่ามีบัญชีผ่อนชำระ (LT) ส่งมาด้วยหรือไม่
        const hasInstallmentPlan = accounts.some(acc => acc.loantype === "LT");

        if (hasInstallmentPlan) {
            const currentAccountNos = accounts.map(acc => acc.accountNo);
            
            // Query ยอดผ่อนชำระเดิมจาก tbl_account_installment ที่มี status = '1' และไม่ใช่ account ที่กำลังทำรายการอยู่
            let oldInstallmentsQuery = AppDataSource.getRepository(tblAccountInstallment)
                .createQueryBuilder('ai')
                .select('SUM(ai.installment_amount)', 'oldTotalInstallment')
                .where('ai.cus_target_id = :cusTargetId', { cusTargetId })
                .andWhere('ai.status = :status', { status: '1' });
                
            if (currentAccountNos.length > 0) {
                oldInstallmentsQuery = oldInstallmentsQuery.andWhere('ai.account_no NOT IN (:...currentAccountNos)', { currentAccountNos });
            }
            
            const oldInstallmentsRow = await oldInstallmentsQuery.getRawOne();
            const oldTotalInstallment = Number(oldInstallmentsRow?.oldTotalInstallment || 0);
            
            if (oldTotalInstallment > 0) {
                logger.info(`[checkIncomeService] พบยอดผ่อนชำระเดิม (ไม่รวมบัญชีที่เลือก) รวม = ${oldTotalInstallment}`);
                totalMinAmount += oldTotalInstallment;
            }
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
