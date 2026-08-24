const { AppDataSource } = require('../config/database');
const tblAccountHairCut = require('../entities/tblAccountHairCut');
const tblAccountInstallment = require('../entities/tblAccountInstallment');
const tblCusTarget = require('../entities/tblCusTarget');
const tblAccountCusTarget = require('../entities/tblAccountCusTarget');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'contractHelper' });

const augmentAccountsWithDbData = async (accounts) => {
    for (let acc of accounts) {
        if (acc.isHaircut) {
            const resDb = await AppDataSource.getRepository(tblAccountHairCut).find({
                select: { amount: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].amount;
            }
        } else {
            const resDb = await AppDataSource.getRepository(tblAccountInstallment).find({
                select: { installmentAmount: true, installmentTerm: true },
                where: { accountNo: acc.accountNo },
                order: { createdDate: "DESC" },
                take: 1
            });
            if (resDb && resDb.length > 0) {
                acc.paymentAmount = resDb[0].installmentAmount;
                acc.installmentTerms = resDb[0].installmentTerm;

                // If there is only one default installment in the array, update it too
                if (acc.installments && acc.installments.length === 1) {
                    acc.installments[0].amount = resDb[0].installment_amount;
                }
            }
        }
    }
    return accounts;
};

const augmentCustomerInfoWithDbData = async (cusTargetId, accountNo) => {
    let finalCusTargetId = cusTargetId;

    if (!finalCusTargetId && accountNo) {
        // Try to find cusTargetId from tblAccountCusTarget
        const accountCusTarget = await AppDataSource.getRepository(tblAccountCusTarget).findOne({
            where: { accountNo: accountNo }
        });
        if (accountCusTarget) {
            finalCusTargetId = accountCusTarget.cusTargetId;
        }
    }

    if (!finalCusTargetId) {
        logger.warn(`augmentCustomerInfoWithDbData: Missing both cusTargetId and accountNo. Cannot fetch customer details.`);
        return {};
    }

    const cusTarget = await AppDataSource.getRepository(tblCusTarget).findOne({
        where: { id: finalCusTargetId }
    });

    if (!cusTarget) {
        logger.warn(`augmentCustomerInfoWithDbData: Customer target not found for id ${finalCusTargetId}`);
        return {};
    }

    return {
        cusTargetId: cusTarget.id,
        firstName: cusTarget.firstName,
        lastName: cusTarget.lastName,
        citizenId: cusTarget.citizenId,
        cifNo: cusTarget.cifNo,
        address: cusTarget.address,
        email: cusTarget.email,
        mobileNo: cusTarget.telNo, // Contract templates might use mobileNo
        telNo: cusTarget.telNo,
        birthday: cusTarget.birthday
    };
};

module.exports = {
    augmentAccountsWithDbData,
    augmentCustomerInfoWithDbData
};
