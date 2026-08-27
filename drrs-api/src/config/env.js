const requiredVariables = [
    'DB_TYPE',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASS',
    'DB_NAME',
    'DB_SCHEMA',
    'CRYPTO_KEY', 
    'CRYPTO_IV', 
    'CRYPTO_ALGORITHM',
    'JWT_SECRET',
    'VERIFY_LASERID_URL', 
    'VERIFY_LASERID_APP_ID',
    'VERIFY_LASERID_APP_KEY',
    'VERIFY_LASERID_TOKEN',
    'LOG_DIR',
    'CONTRACT_SAVE_PATH',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_FROM'
];

requiredVariables.forEach((variable) => {
    if (!process.env[variable]) {
        console.error(`🚨 FATAL ERROR: Missing environment variable: ${variable}`);
        process.exit(1); // สั่งปิดโปรแกรมทันทีถ้ายกตัวแปรมาไม่ครบ ป้องกันบั๊กลึกลับ
    }
});

// ส่งออกตัวแปรไปให้ไฟล์อื่นๆ นำไปใช้ต่อ
module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database
    dbType: process.env.DB_TYPE,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASS,
    dbName: process.env.DB_NAME,
    dbSchema: process.env.DB_SCHEMA,

    // Database — connection pool & logging
    // ทุกตัวมีค่า default จึงไม่ต้องใส่ใน .env ก็ทำงานได้
    // และไม่ได้อยู่ใน requiredVariables ข้างบน ระบบเดิมจึงไม่พัง
    dbPoolMax: Number(process.env.DB_POOL_MAX) || 20,
    dbConnTimeoutMs: Number(process.env.DB_CONN_TIMEOUT_MS) || 5000,
    dbIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
    dbLogQueries: process.env.DB_LOG_QUERIES === 'true',
    dbSlowQueryMs: Number(process.env.DB_SLOW_QUERY_MS) || 1000,

    // DOPA
    laserIdUrl: process.env.VERIFY_LASERID_URL,
    laserIdAppId: process.env.VERIFY_LASERID_APP_ID,
    laserIdAppKey: process.env.VERIFY_LASERID_APP_KEY,
    authorization: process.env.VERIFY_LASERID_TOKEN,

    // Encrypt
    cryptoKey: process.env.CRYPTO_KEY,
    cryptoIv: process.env.CRYPTO_IV,
    cryptoAlgorithm: process.env.CRYPTO_ALGORITHM,

    // JWT session (auth)
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '60m',

    //Utils
    logDir: process.env.LOG_DIR,

    // PDF & Email
    contractSavePath: process.env.CONTRACT_SAVE_PATH,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpFrom: process.env.SMTP_FROM
};