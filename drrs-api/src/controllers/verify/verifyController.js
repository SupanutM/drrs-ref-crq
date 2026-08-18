const axios = require('axios');
const https = require('https');
const crypto = require('../../utils/crypto');
const cusTargetService = require('../../services/verify/verifyCusTargetService');
const laserIdService = require('../../services/verify/verifyLaserIdService');
const updateCusTargetService = require('../../services/verify/updateCusTargetSerivce');
const customerLookupService = require('../../services/customer/customerLookupService');
const createStepService = require('../../services/util/systemLog/createStepService');
const { sendSuccess, sendError } = require('../../utils/responseHandler');
const baseLogger = require('../../utils/logger');
const veriryToken = require('../../utils/verifyToken');
const tblSettingsStep = require('../../entities/tblSettingsStep');
const { AppDataSource } = require('../../config/database');
const { loggers } = require('winston');

const logger = baseLogger.child({ context: 'verifyFlowController' });

const verifyController = async (req, res) => {
    try {
        const { verifyCode, citizenId, name, surname, dateOfBirth, laserCardId, email, telNo } = req.body;

        const token = req.headers["authorization"];

        if (!verifyCode || !citizenId || !name || !surname || !dateOfBirth || !laserCardId) {
            logger.warn('ข้อมูล Request ไม่ครบถ้วนสำหรับการยืนยันตัวตนแบบ 2 ขั้นตอน');
            return sendError(res, 'กรุณาส่งข้อมูลให้ครบถ้วน', 400);
        }

        // =========================================================
        // 🌟 Step 1: ตรวจสอบข้อมูลลูกค้าใน Database (tbl_cus_target)
        // =========================================================
        logger.info(`[Step 1] เริ่มตรวจสอบ Customer Target: ${name} ${surname} ${verifyCode}`);
        const targetResult = await cusTargetService.verifyCusTargetService(name, surname, verifyCode);

        // ถ้าหาลูกค้าไม่เจอ หรือรหัส Verify Code ไม่ตรง ให้ตีกลับทันที (Fail-Fast)
        if (!targetResult.success) {
            logger.warn(`[Step 1 Failed] Verify Name And verifyCode: ${name} ${verifyCode} - ${targetResult.message}`);
            res.locals.step = 'stepVerifyTarget';
            return sendError(res, targetResult.message, 400);
        }

        // =========================================================
        // 🌟 Step Log (1): สร้างหรืออัปเดต record แรกที่ tbl_settings_step (stepVerifyTarget = "1")
        // =========================================================
        const accountsToUpdate = targetResult.data?.accounts || [];
        if (targetResult.data?.accountNo && !accountsToUpdate.find(a => a.accountNo === targetResult.data.accountNo)) {
            accountsToUpdate.push({ accountNo: targetResult.data.accountNo });
        }

        // =========================================================
        // 🌟 ตรวจสอบว่าลงทะเบียนครบแล้วหรือยัง
        // ถ้าทุกบัญชีมี stepConfirmPlan=1 และ stepSendToCbs=1 → ไม่อนุญาตให้เข้าระบบอีก
        // =========================================================
        if (accountsToUpdate.length > 0) {
            const stepRepo = AppDataSource.getRepository(tblSettingsStep);
            const stepRecords = await stepRepo.find({
                where: accountsToUpdate.map(acc => ({ accountNo: acc.accountNo }))
            });

            let accountsToReset = [];

            const allCompleted = accountsToUpdate.length > 0 &&
                accountsToUpdate.every(acc => {
                    const step = stepRecords.find(s => s.accountNo === acc.accountNo);
                    if (step) {
                        const isConfirmPlan = String(step.stepConfirmPlan).trim() === '1';
                        const isSendToCbs = String(step.stepSendToCbs).trim() === '1';
                        return isConfirmPlan && isSendToCbs;
                    }
                    return false;
                });

            accountsToUpdate.forEach(acc => {
                const step = stepRecords.find(s => s.accountNo === acc.accountNo);
                if (step) {
                    const isConfirmPlan = String(step.stepConfirmPlan).trim() === '1';
                    const isSendToCbs = String(step.stepSendToCbs).trim() === '1';

                    if (isConfirmPlan && !isSendToCbs) {
                        // เลือกแผนแล้วแต่ยังไม่เซ็นสัญญา ต้องเคลียร์ค่า
                        accountsToReset.push(acc.accountNo);
                    }
                }
            });

            if (allCompleted) {
                logger.warn(`[Block] ลูกค้าลงทะเบียนครบทุกบัญชีแล้ว — ปฏิเสธการเข้าระบบ`);
                return sendError(res, 'ท่านได้ลงทะเบียนปรับปรุงโครงสร้างหนี้เรียบร้อยแล้ว ไม่สามารถดำเนินการซ้ำได้', 403);
            }

            // =========================================================
            // 🌟 Inactive แผนค้าง หากมีบัญชีที่ต้องการ reset
            // =========================================================
            if (accountsToReset.length > 0) {
                const queryRunner = AppDataSource.createQueryRunner();
                await queryRunner.connect();
                await queryRunner.startTransaction();

                try {
                    for (const accNo of accountsToReset) {
                        logger.info(`[Reset Step] Inactive แผนค้างสำหรับ AccountNo: ${accNo}`);

                        // 1. Inactive tbl_account_hair_cut
                        await queryRunner.query(`
                            UPDATE drrs.tbl_account_hair_cut
                            SET status = '0', delete_date = CURRENT_TIMESTAMP, delete_by = 'system_reset'
                            WHERE account_no = $1 AND status != '0'
                        `, [accNo]);

                        // 2. Inactive tbl_account_installment
                        await queryRunner.query(`
                            UPDATE drrs.tbl_account_installment
                            SET status = '0', delete_date = CURRENT_TIMESTAMP, delete_by = 'system_reset'
                            WHERE account_no = $1 AND status != '0'
                        `, [accNo]);
                    }
                    await queryRunner.commitTransaction();
                } catch (error) {
                    await queryRunner.rollbackTransaction();
                    logger.error(`Error inactive accounts: ${error.message}`);
                    throw error; // Or handle it gracefully
                } finally {
                    await queryRunner.release();
                }

                // 3. Reset Step (Done sequentially outside transaction since createStepService manages its own DB connections)
                for (const accNo of accountsToReset) {
                    await createStepService.updateStepService(accNo, { stepConfirmPlan: "0" }, 'system_reset');
                }

                // 4. Update the targetResult in memory so the response sent to frontend reflects the reset
                if (targetResult.data && targetResult.data.accounts) {
                    targetResult.data.accounts.forEach(acc => {
                        if (accountsToReset.includes(acc.accountNo)) {
                            acc.isRegistered = false;
                        }
                    });
                }
            }
        }

        if (accountsToUpdate.length > 0) {
            await Promise.all(accountsToUpdate.map(async (acc) => {
                logger.info(`[Step Log] บันทึก step stepVerifyTarget: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                await createStepService.createStepService(acc.accountNo, { stepVerifyTarget: "1" }, 'verify-register');
            }));
        }

        // =========================================================
        // 🌟 Step 2: ตรวจสอบ Laser ID DOPA
        // =========================================================
        logger.info(`[Step 2] ผ่านการตรวจสอบ Target. เริ่มตรวจสอบ Laser ID สำหรับ PID: ${citizenId}`);

        // แพ็คข้อมูลเตรียมส่งให้ Laser Service
        const laserPayload = { citizenId, name, surname, dateOfBirth, laserCardId };
        const laserResult = await laserIdService.verifyLaserIdService(laserPayload);

        // ถ้าข้อมูลบัตรประชาชนไม่ถูกต้องตามฐานข้อมูลกรมการปกครอง
        if (!laserResult.success) {
            const errorMessage = laserResult.message || "Laser ID verification failed";
            logger.warn(`[Step 2 Failed] Laser ID verification failed`);
            res.locals.step = 'stepVerifyLaser';
            return res.status(401).json({
                success: false,
                message: `[Step 2 Failed] ${errorMessage}`
            });
        }

        // =========================================================
        // 🌟 Step 2.1: อัปเดตข้อมูล email และ dateOfBirth ลง table tbl_cus_target (เมื่อผ่านการตรวจสอบ Laser ID แล้วเท่านั้น)
        // =========================================================
        logger.info(`email: ${email} dateOfBirth: ${dateOfBirth}`);
        // ใช้ cusTargetId จาก verify response แทน accountNo เพื่อ update tbl_cus_target โดยตรง
        const cusTargetId = targetResult.data.cusTargetId;
        if (cusTargetId) {
            let fullAddress = targetResult.data.address || "";
            if (!fullAddress) {
                try {
                    const customer_number = targetResult.data.cifNo || "";
                    const dbCitizenId = targetResult.data.citizenId || "";
                    logger.info(`customer_number: ${customer_number}`);
                    logger.info(`dbCitizenId: ${dbCitizenId}`);
                    fullAddress = await customerLookupService.getCustomerFullAddress(customer_number, dbCitizenId);
                    logger.info(`fullAddress: ${fullAddress}`);
                } catch (error) {
                    logger.warn(`[Step 2.1] Error looking up customer address: ${error.message}`);
                }
            } else {
                logger.info(`[Step 2.1] มีที่อยู่แล้วในระบบ ไม่ต้องดึงจาก Lookup API`);
            }

            logger.info(`[Step 2.1] ผ่าน Laser ID สำหรับ cusTargetId: ${cusTargetId} ทำการอัปเดต Email, วันเกิด, เบอร์โทร และที่อยู่ ที่ตาราง tbl_cus_target`);
            
            const payloadToUpdate = { email, dateOfBirth, telNo };
            if (!targetResult.data.address) {
                payloadToUpdate.address = fullAddress;
            }

            await updateCusTargetService.updateCusTargetService(cusTargetId, payloadToUpdate);
            if (email) targetResult.data.email = email;
            if (telNo) targetResult.data.telNo = telNo;
            if (fullAddress && !targetResult.data.address) targetResult.data.address = fullAddress;
        }

        // =========================================================
        // 🌟 Success: ผ่านทั้ง 2 ขั้นตอน ส่งข้อมูลกลับหน้าบ้าน
        // =========================================================
        logger.info(`ยืนยันตัวตนสำเร็จ 100% สำหรับ cusTargetId: ${cusTargetId}`);

        // =========================================================
        // 🌟 Step Log (2): อัปเดตสถานะ stepVerifyLaser = "1" ลงใน tbl_settings_step
        // =========================================================
        if (accountsToUpdate.length > 0) {
            await Promise.all(accountsToUpdate.map(async (acc) => {
                logger.info(`[Step Log] อัปเดต step stepVerifyLaser: "1" สำหรับ AccountNo: ${acc.accountNo}`);
                await createStepService.updateStepService(acc.accountNo, { stepVerifyLaser: "1" }, 'verify-register');
            }));
        }

        if (dateOfBirth) targetResult.data.dateOfBirth = dateOfBirth;
        if (citizenId) targetResult.data.citizenId = citizenId;

        // ส่ง Success Response พร้อมข้อมูลที่จำเป็น (เช่น firstName ที่ได้จาก Step 1)
        return sendSuccess(res, 'ยืนยันตัวตนและตรวจสอบบัตรประชาชนสำเร็จเรียบร้อย',
            {
                targetInfo: targetResult.data,
                laserStatus: laserResult.message
            }
        );

    } catch (error) {
        logger.error(`System Error in verifyTargetAndLaser: ${error.message}`);
        return sendError(res, 'เกิดข้อผิดพลาดในการประมวลผล', 500, error);
    }
};

module.exports = {
    verifyController
};