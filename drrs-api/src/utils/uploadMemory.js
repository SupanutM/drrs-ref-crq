const multer = require('multer');

// เก็บไฟล์ที่ upload ไว้ใน memory (buffer) ไม่เขียนลงดิสก์ — ไฟล์ import (xlsx/csv) มีขนาดเล็ก
// และ parse ครั้งเดียวจบ ไม่จำเป็นต้องมี temp file ค้างบน server
const storage = multer.memoryStorage();

const uploadXlsx = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // จำกัด 10MB ต่อไฟล์ กันไฟล์ผิดพลาด/ตั้งใจโจมตี
    fileFilter: (req, file, cb) => {
        // ไฟล์จริงจากทีม master data เป็น .csv (Windows-874, ไม่มี header) — เพิ่มรองรับ
        // ไว้คู่กับ .xlsx เดิม (ยังใช้ upload แบบมี header ได้เหมือนก่อน)
        const allowedExt = /\.(xlsx|csv)$/i;
        if (!allowedExt.test(file.originalname)) {
            return cb(new Error('รองรับเฉพาะไฟล์ .xlsx หรือ .csv เท่านั้น'));
        }
        cb(null, true);
    }
});

// ไฟล์ข้อมูลชี้เป้า (ลูกค้า/บัญชี/แผน) รูปแบบใหม่ทีมข้อมูลส่งเป็น .csv เท่านั้น (pipe-delimited,
// Windows-874, ไม่มี header) — เอกสารตัวอย่างที่ผ่านการแปลงเป็น .xlsx มาก่อนทำเลขบัตรประชาชนเพี้ยน
// จึงตัดการรองรับ .xlsx ของไฟล์ชุดนี้ทิ้งไป (ต่างจาก uploadXlsx ของ master data ที่ยังรองรับทั้งคู่)
const uploadCsvOnly = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!/\.csv$/i.test(file.originalname)) {
            return cb(new Error('รองรับเฉพาะไฟล์ .csv เท่านั้น'));
        }
        cb(null, true);
    }
});

module.exports = { uploadXlsx, uploadCsvOnly };
