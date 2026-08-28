const env = require('../config/env')
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const customFormat = winston.format.printf(({ level, message, timestamp, context }) => {
    const contextStr = context ? ` [${context}]` : '';
    return `[${timestamp}] ${level.toUpperCase()}${contextStr}: ${message}`;
});

// ไฟล์ error เก็บเสมอ (ทุกโหมด) — ปริมาณน้อย ไม่กระทบ Disk IO
const fileRotateError = new winston.transports.DailyRotateFile({
    filename: path.join(env.logDir, 'drrs-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d' // Keep logs for 30 days
});

// ไฟล์ app (info ทุก request) — ตัวเขียนดิสก์หนักสุดตอนโหลด
// ระหว่าง Load Test: "ไม่สร้าง" transport นี้เลย (ไม่ใช่แค่ปรับ level)
// เพื่อตัดการเขียนไฟล์ app ออกทั้งหมด
const fileRotateApp = new winston.transports.DailyRotateFile({
    filename: path.join(env.logDir, 'drrs-app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d'
});

const consoleTransport = new winston.transports.Console({
    // ระหว่าง Load Test: พิมพ์ console แค่ระดับ error
    // (ถ้ารันผ่าน pm2/service ที่ redirect stdout ลงไฟล์ การพิมพ์ info/warn
    //  รัวๆ ตอนโหลด = เขียนดิสก์ทางอ้อม ทำ Disk IO ตันแม้ปิด winston file แล้ว)
    level: env.loadTestMode ? 'error' : 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, context }) => {
            const contextStr = context ? ` [\x1b[36m${context}\x1b[0m]` : '';
            return `[${timestamp}] ${level}${contextStr}: ${message}`;
        })
    )
});

// ประกอบ transport ตามโหมด
//   ปกติ      : error file + app file + console(info)
//   Load Test : error file + console(error)  — ตัด app file ออก, console แค่ error
const transports = env.loadTestMode
    ? [fileRotateError, consoleTransport]
    : [fileRotateError, fileRotateApp, consoleTransport];

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports,
});

module.exports = logger;
