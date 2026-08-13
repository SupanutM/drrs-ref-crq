const env = require('../config/env')
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const customFormat = winston.format.printf(({ level, message, timestamp, context }) => {
    const contextStr = context ? ` [${context}]` : '';
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}`;
});

const fileRotateError = new winston.transports.DailyRotateFile({
    filename: path.join(env.logDir, 'drrs-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d' // Keep logs for 30 days
});

const fileRotateApp = new winston.transports.DailyRotateFile({
    filename: path.join(env.logDir, 'drrs-app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d'
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        fileRotateError,
        fileRotateApp,
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.printf(({ level, message, timestamp, context }) => {
                    const contextStr = context ? ` [\x1b[36m${context}\x1b[0m]` : '';
                    return `[${timestamp}] ${level}${contextStr}: ${message}`;
                })
            )
        })
    ]
});

module.exports = logger;