// utils/sqlProvider.js
const fs = require('fs');
const path = require('path');

/**
 * ฟังก์ชันอ่านไฟล์ SQL จากโฟลเดอร์ sql_scripts ที่อยู่ระดับเดียวกับ .env
 */
const loadSqlQuery = (fileName) => {
    // 🌟 process.cwd() จะชี้ไปยัง Root Folder ของโปรเจกต์เสมอ (ตำแหน่งที่เราใช้รันคำสั่ง node)
    // ทำให้ path เป็นแบบ Relative กับตัวโปรเจกต์ ไม่ต้องกังวลเรื่อง Absolute Path ของเครื่อง
    const sqlDirectory = path.join(process.cwd(), 'sql_scripts');
    const filePath = path.join(sqlDirectory, fileName);

    try {
        // อ่านไฟล์เป็น UTF-8 และแปลงเป็น String
        const sqlString = fs.readFileSync(filePath, 'utf8');
        return sqlString;
    } catch (error) {
        throw new Error(`ไม่สามารถโหลดไฟล์ SQL ได้: ${filePath} - ${error.message}`);
    }
};

module.exports = {
    loadSqlQuery
};