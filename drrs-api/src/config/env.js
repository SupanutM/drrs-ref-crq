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
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_FROM',
    'GET_ACCESS_TOKEN_URL',
    'GET_ACCESS_TOKEN_CLIENT_ID',
    'GET_ACCESS_TOKEN_CLIENT_SECRET',
    'CBS_INQUIRY_ACCOUNT_URL',
    'CBS_INQUIRY_ACCOUNT_APP_ID',
    'CBS_INQUIRY_ACCOUNT_APP_KEY',
    'CBS_REGIS_DIGITALLOAN_URL',
    'CBS_REGIS_DIGITALLOAN_APP_ID',
    'CBS_REGIS_DIGITALLOAN_APP_KEY'
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
    // เดิมไม่มี timeout เลย (รอไม่จำกัด) การใส่ค่าสั้นเกินไปทำให้ start ไม่ขึ้น
    // ตอนเครื่องมีงานอื่นแย่ง CPU อยู่ (เจอจริงตอน Chromium อุ่นเครื่องพร้อมกัน
    // ที่ 5000 ms แล้วได้ "Connection terminated due to connection timeout")
    // ตั้ง 30 วินาที เพื่อยังมีเพดานกันค้างถาวร แต่ไม่ไปตัดการ start ปกติ
    dbConnTimeoutMs: Number(process.env.DB_CONN_TIMEOUT_MS) || 30000,
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

    // Load Test Mode — ตั้ง true เพื่อลดงานที่ไม่เกี่ยวกับการวัดประสิทธิภาพแอปจริง
    // (ข้าม DOPA/CUST API ภายนอก, ลดการเขียน log ลงไฟล์, ข้ามการเซฟ PDF ลงดิสก์)
    // ห้ามเปิดบน Production เด็ดขาด
    loadTestMode: process.env.LOAD_TEST_MODE === 'true',

    // CUST360 — path ไฟล์ cert (.pem/.cer/.crt หรือ .p12/.pfx) ต้องตั้งเสมอ (ไม่มี fallback)
    custCaCertPath: process.env.CUST_CA_CERT_PATH,
    // รหัสผ่านไฟล์ .p12/.pfx (PKCS#12) — จำเป็นเฉพาะตอนไฟล์ cert เป็น .p12/.pfx
    // ไฟล์ .pem/.cer/.crt ไม่ต้องใช้ค่านี้
    custCertPassphrase: process.env.CUST_CERT_PASSPHRASE,

    // PDF & Email
    contractSavePath: process.env.CONTRACT_SAVE_PATH,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpFrom: process.env.SMTP_FROM,

    // SSO Get Access Token — ใช้ขอ Bearer token ก่อนเรียก CBS API ตัวใดๆ (client_credentials)
    getAccessTokenUrl: process.env.GET_ACCESS_TOKEN_URL,
    getAccessTokenClientId: process.env.GET_ACCESS_TOKEN_CLIENT_ID,
    getAccessTokenClientSecret: process.env.GET_ACCESS_TOKEN_CLIENT_SECRET,

    // CBS Inquiry Account — ต้องมี Bearer token จาก SSO ก่อนเรียก (ดู getAccessTokenService)
    cbsInquiryAccountUrl: process.env.CBS_INQUIRY_ACCOUNT_URL,
    cbsInquiryAccountAppId: process.env.CBS_INQUIRY_ACCOUNT_APP_ID,
    cbsInquiryAccountAppKey: process.env.CBS_INQUIRY_ACCOUNT_APP_KEY,
    // ค่า ServiceName ที่ต้องส่งใน body (ตาม spec ของทีม CBS) — ไม่บังคับใน requiredVariables
    // เพราะยังไม่ทราบชื่อค่าที่ถูกต้อง ต้องเติมใน .env ก่อนขึ้นจริง
    cbsInquiryAccountServiceName: process.env.CBS_INQUIRY_ACCOUNT_SERVICE_NAME || '',

    // CBS Register Digitalloan — ยิงตอน "ยอมรับสัญญา" เพื่อลงทะเบียนแผนปรับโครงสร้างหนี้กับ CBS จริง
    // ต้องมี Bearer token จาก SSO ก่อนเรียกเหมือน Inquiry Account (ดู getAccessTokenService)
    cbsRegisDigitalLoanUrl: process.env.CBS_REGIS_DIGITALLOAN_URL,
    cbsRegisDigitalLoanAppId: process.env.CBS_REGIS_DIGITALLOAN_APP_ID,
    cbsRegisDigitalLoanAppKey: process.env.CBS_REGIS_DIGITALLOAN_APP_KEY,
    // ServiceName ตาม spec (sub service ภายใต้ 8002) — ระบุเป็น "REGDTLN69"
    cbsRegisDigitalLoanServiceName: process.env.CBS_REGIS_DIGITALLOAN_SERVICE_NAME || 'REGDTLN69'
};