const rateLimit = require('express-rate-limit');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'rateLimiter' });

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
    message: {
        status: false,
        message: 'มีผู้ใช้งานเข้าใช้มากเกินไป กรุณาลองใหม่ในภายหลัง'
    },
    handler: (req, res, next, options) => {
        logger.warn(`Too many requests from IP: ${req.ip} - blocked by rate limiter.`);
        res.status(options.statusCode).send(options.message);
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = { apiLimiter };
