const axios = require('axios');
const crypto = require('../../utils/crypto');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'laserService' });

const verifyLaserIdService = async (payload) => {
    try {
        const { citizenId, name, surname, dateOfBirth, laserCardId } = payload;

        const citizenIdDecrypted = crypto.decryptGCM(citizenId, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const laserCardIdDecrypted = crypto.decryptGCM(laserCardId, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const nameDecrypted = crypto.decryptGCM(name, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const surnameDecrypted = crypto.decryptGCM(surname, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);

        const resaser = {
            AppId: "NDRS",
            PID: citizenIdDecrypted,
            FirstName: nameDecrypted,
            LastName: surnameDecrypted,
            BirthDay: dateOfBirth,
            Laser: laserCardIdDecrypted,
        };

        const headersLaser = {
            "Content-Type": "application/json",
            app_id: process.env.VERIFY_LASERID_APP_ID,
            app_key: process.env.VERIFY_LASERID_APP_KEY,
        };

        const result = await axios.post(process.env.VERIFY_LASERID_URL, resaser, { headers: headersLaser });
        const res = result.data;

        if (res.code == "0") {
            return {
                success: true,
                code: res.code,
                message: res.desc
            };
        } else {
            const isDescError = ["1", "4", "5"].includes(res.code);
            const isDetailedError = ["403", "400"].includes(res.code);

            return {
                success: false,
                code: res.code,
                message: isDescError ? res.desc : res.message == undefined ? res.desc : res.message,
                errors: isDetailedError ? res.errors : []
            };
        }

    } catch (error) {
        logger.error(`NDRS API Error: ${error.message}`);
        return {
            success: false,
            code: null,
            message: 'ไม่สามารถเชื่อมต่อระบบตรวจสอบบัตรประชาชนได้'
        };
    }
};

module.exports = {
    verifyLaserIdService
};