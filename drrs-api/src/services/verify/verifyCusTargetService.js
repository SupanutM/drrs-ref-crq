const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');
const tblSettingsStep = require('../../entities/tblSettingsStep');
const tblAccountInstallment = require('../../entities/tblAccountInstallment');
const masterPlan = require('../../services/plan/masterPlanService');
const baseLogger = require('../../utils/logger');
const crypto = require('../../utils/crypto');
const { systemLogService } = require('../util/systemLog/systemLogService');
const logger = baseLogger.child({ context: 'verifyService' });

const verifyCusTargetService = async (firstName, lastName, verifyCode) => {
    try {

        const firstNameDecrypted = crypto.decryptGCM(firstName, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const lastNameDecrypted = crypto.decryptGCM(lastName, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);

        const tblCusTargetRepo = AppDataSource.getRepository(tblCusTarget);

        // ปิด log info ตอนสำเร็จ — ซ้ำซ้อนกับ tbl_system_log + ลด Disk IO
        // (ห้าม log verifyCode — เป็นข้อมูลอ่อนไหว)
        // logger.info(`[verify] ค้นหา customer target`)

        const customer = await tblCusTargetRepo.findOne({
            where: {
                firstName: firstNameDecrypted,
                lastName: lastNameDecrypted,
                verifyCode: verifyCode,
                status: "1"
            },
            relations: { accounts: true }
        });
        // logger.info(`[verify] ผลค้นหา customer target: ${customer ? `พบ (id: ${customer.id})` : 'ไม่พบ'}`);

        if (!customer) {
            return {
                success: false,
                message: 'ไม่พบข้อมูลลูกค้า หรือรหัสยืนยันไม่ถูกต้อง'
            };
        }

        let groupedAccounts = {};
        if (customer.accounts && customer.accounts.length > 0) {
            customer.accounts.forEach(acc => {
                if (!groupedAccounts[acc.accountNo]) {
                    groupedAccounts[acc.accountNo] = {
                        accountNo: acc.accountNo,
                        minAmount: acc.minAmount,
                        maxAmount: acc.maxAmount,
                        planNos: [],
                        accPlans: []
                    };
                }
                if (acc.planNo && !groupedAccounts[acc.accountNo].planNos.includes(acc.planNo)) {
                    groupedAccounts[acc.accountNo].planNos.push(acc.planNo);
                    groupedAccounts[acc.accountNo].accPlans.push(acc);
                }
            });
        }

        let accountsWithPlans = [];
        const tblSettingsStepRepo = AppDataSource.getRepository(tblSettingsStep);
        if (Object.keys(groupedAccounts).length > 0) {
            accountsWithPlans = await Promise.all(Object.values(groupedAccounts).map(async (groupedAcc) => {
                let planData = null;
                try {
                    const res = await masterPlan.masterPlanService(groupedAcc.planNos, groupedAcc.accountNo, groupedAcc.accPlans);
                    if (res && res.success) {
                        planData = res.data;
                    }
                } catch (err) {
                    logger.warn(`Error fetching master plan for account ${groupedAcc.accountNo}: ${err.message}`);
                }
                
                let isRegistered = false;
                try {
                    const stepSetting = await tblSettingsStepRepo.findOne({
                        where: { accountNo: groupedAcc.accountNo }
                    });
                    if (stepSetting && String(stepSetting.stepConfirmPlan).trim() === '1') {
                        isRegistered = true;
                    }
                } catch(err) {
                    logger.warn(`Error fetching step setting for account ${groupedAcc.accountNo}: ${err.message}`);
                }

                return {
                    accountNo: groupedAcc.accountNo,
                    isRegistered: isRegistered,
                    minAmount: Number(groupedAcc.minAmount || 0),
                    maxAmount: Number(groupedAcc.maxAmount || 0),
                    masterPlan: planData?.masterPlan || []
                };
            }));
        } else if (customer.accountNo) {
            // Fallback for older single-account flow
            try {
                // For fallback, we might not have planNos, but let's pass empty array and accountNo
                const res = await masterPlan.masterPlanService([], customer.accountNo);
                
                let isRegistered = false;
                try {
                    const stepSetting = await tblSettingsStepRepo.findOne({
                        where: { accountNo: customer.accountNo }
                    });
                    if (stepSetting && String(stepSetting.stepConfirmPlan).trim() === '1') {
                        isRegistered = true;
                    }
                } catch(err) {
                    logger.warn(`Error fetching step setting for legacy account ${customer.accountNo}: ${err.message}`);
                }

                if (res && res.success) {
                    accountsWithPlans.push({
                        accountNo: customer.accountNo,
                        isRegistered: isRegistered,
                        masterPlan: res.data.masterPlan || []
                    });
                }
            } catch (err) {
                logger.warn(`Error fetching master plan for legacy account ${customer.accountNo}: ${err.message}`);
            }
        }

        let oldInstallments = [];
        try {
            oldInstallments = await AppDataSource.getRepository(tblAccountInstallment)
                .find({
                    where: { cusTargetId: customer.id, status: '1' },
                    select: { accountNo: true, installmentAmount: true }
                });
        } catch (err) {
            logger.warn(`Error fetching oldInstallments for customer ${customer.id}: ${err.message}`);
        }

        // audit PLAN_PREVIEW ครั้งเดียวต่อ verify (รวมทุกบัญชีที่ดูแผน) — ไม่แยกราย account
        const viewedAccountNos = accountsWithPlans.map((a) => a.accountNo).filter(Boolean);
        if (viewedAccountNos.length > 0) {
            await systemLogService({
                step: 'PLAN_PREVIEW',
                controller: 'verifyCusTargetService',
                payload: { cusTargetId: customer.id, accountNos: viewedAccountNos },
                responseStatus: 200,
                response: { message: 'ดูแผนสำเร็จ', accountCount: viewedAccountNos.length },
                createdBy: 'system'
            }).catch((err) => logger.warn(`บันทึก audit PLAN_PREVIEW ไม่สำเร็จ: ${err.message}`));
        }

        return {
            success: true,
            message: 'ยืนยันตัวตนสำเร็จ',
            data: {
                cusTargetId: customer.id,        // tbl_cus_target.id — ใช้สำหรับ update-income
                accounts: accountsWithPlans, 
                firstName: customer.firstName,
                lastName: customer.lastName,
                citizenId: customer.citizenId,
                cifNo: customer.cifNo,
                address: customer.address,
                birthday: customer.birthday,
                totalIncome: customer.totalIncome,
                otherIncome: customer.otherIncome,
                totalCost: customer.totalCost,
                netIncome: customer.netIncome,
                oldInstallments: oldInstallments,
                // Keep these at root for backward compatibility if needed, but they are now in accounts
                masterPlan: accountsWithPlans[0]?.masterPlan || []
            },
        };

    } catch (error) {
        logger.error(`Error checking verify code: ${error.message}`);
        throw error;
    }
};

module.exports = { verifyCusTargetService };