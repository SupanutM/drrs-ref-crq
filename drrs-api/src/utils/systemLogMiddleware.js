const { systemLogService } = require('../services/util/systemLog/systemLogService');

/**
 * Shared Middleware / Interceptor สำหรับบันทึกประวัติการทำงานลงตาราง tbl_system_log อัตโนมัติทุกครั้งที่ตอบกลับ Response
 * @param {string} step - ชื่อขั้นตอน (เช่น 'verify-register', 'checkPlan')
 * @param {string} controller - ชื่อ Controller (เช่น 'verifyController', 'checkPlanController')
 */
const systemLogMiddleware = (step, controller) => {
    return (req, res, next) => {
        const originalJson = res.json;
        let responseStatus = 200;

        // Intercept res.status เพื่อเก็บค่า Status Code
        const originalStatus = res.status;
        res.status = function (code) {
            responseStatus = code;
            return originalStatus.apply(res, arguments);
        };

        // Intercept res.json เพื่อเก็บผลลัพธ์และส่งบันทึก System Log
        res.json = function (body) {
            const createdBy = 'DRRS';
            const currentStep = res.locals.step || step;

            if (!res.locals.skipSystemLog) {
                systemLogService({
                    step: currentStep,
                    controller: controller,
                    payload: req.body,
                    responseStatus: res.statusCode || responseStatus,
                    response: body,
                    createdBy: createdBy
                }).catch(error => {
                    console.error(`[System Log Middleware Error]: ${error.message}`);
                });
            }

            return originalJson.apply(res, arguments);
        };

        next();
    };
};

module.exports = {
    systemLogMiddleware
};
