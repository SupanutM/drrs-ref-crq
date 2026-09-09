-- ============================================================
-- Migration: เพิ่มรองรับไฟล์ import ข้อมูลบัญชี (U_DRRS_ACCOUNT_TARGET_YYYYMMDD.csv)
--            ที่มีคอลัมน์วันหมดอายุ (EXPIRE_DATE, รูปแบบ YYYYMMDD) เพิ่มมาเป็นคอลัมน์ที่ 6
--
-- drrs.tbl_account_cus_target
--   - เปลี่ยนชื่อคอลัมน์ end_date -> expire_date (รันครั้งเดียว ถ้าคอลัมน์ expire_date มีอยู่แล้ว
--     ให้ข้ามคำสั่งนี้)
--
-- ต้อง match กับ entity: drrs-api/src/entities/tblAccountCusTarget.js
-- รันไฟล์นี้ครั้งเดียวกับ DB ที่มีตารางนี้อยู่แล้ว
-- ============================================================

ALTER TABLE drrs.tbl_account_cus_target RENAME COLUMN end_date TO expire_date;

-- ตรวจสอบผลลัพธ์หลัง migrate
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'drrs' AND table_name = 'tbl_account_cus_target'
ORDER BY ordinal_position;
