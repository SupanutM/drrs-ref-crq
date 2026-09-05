-- ============================================================
-- Migration: รองรับไฟล์ import ข้อมูลชี้เป้ารูปแบบใหม่ (.csv pipe-delimited, Windows-874, ไม่มี header)
--
-- 1) drrs.tbl_cus_target
--    - เพิ่มคอลัมน์ type (ประเภทลูกค้า ตามไฟล์คอลัมน์ที่ 6)
--    - tel_no / birthday / total_income / total_cost / net_income / other_income
--      เปลี่ยนเป็น nullable — ไฟล์ import ใหม่ไม่มีคอลัมน์เหล่านี้ (กรอกเพิ่มทีหลังใน flow อื่น)
-- 2) drrs.tbl_mt_master_plan
--    - เปลี่ยนชื่อคอลัมน์ desc (เดิม) -> desc_en (คำอธิบายแผนภาษาอังกฤษ) ให้ตรงคู่กับ desc_th
--    - เพิ่มคอลัมน์ desc_th (คำอธิบายแผนภาษาไทย)
--
-- ต้อง match กับ entity:
--   drrs-api/src/entities/tblCusTarget.js
--   drrs-api/src/entities/tblMtMasterPlan.js
-- รันไฟล์นี้ครั้งเดียวกับ DB ที่มีตารางเหล่านี้อยู่แล้ว
-- ============================================================

ALTER TABLE drrs.tbl_cus_target ADD COLUMN IF NOT EXISTS type VARCHAR(10);

ALTER TABLE drrs.tbl_cus_target ALTER COLUMN tel_no DROP NOT NULL;
ALTER TABLE drrs.tbl_cus_target ALTER COLUMN total_income DROP NOT NULL;
ALTER TABLE drrs.tbl_cus_target ALTER COLUMN total_cost DROP NOT NULL;
ALTER TABLE drrs.tbl_cus_target ALTER COLUMN net_income DROP NOT NULL;
ALTER TABLE drrs.tbl_cus_target ALTER COLUMN other_income DROP NOT NULL;
-- birthday เป็น varchar(8) อยู่แล้วและไม่มี NOT NULL ใน DB ส่วนใหญ่ (เช็คก่อนรัน ถ้า DB จริงตั้ง
-- NOT NULL ไว้ ให้ยกเลิก comment บรรทัดถัดไป)
-- ALTER TABLE drrs.tbl_cus_target ALTER COLUMN birthday DROP NOT NULL;

-- drrs.tbl_account_cus_target.max_amount: ไฟล์ import ข้อมูลบัญชีรูปแบบใหม่ไม่มีคอลัมน์นี้
-- เปลี่ยนเป็น nullable และตัด default 0 ทิ้ง (ไม่มีค่า -> ต้องเป็น null ไม่ใช่ 0)
ALTER TABLE drrs.tbl_account_cus_target ALTER COLUMN max_amount DROP NOT NULL;
ALTER TABLE drrs.tbl_account_cus_target ALTER COLUMN max_amount DROP DEFAULT;

-- เปลี่ยนชื่อคอลัมน์ desc -> desc_en (รันครั้งเดียว ถ้าคอลัมน์ desc_en มีอยู่แล้วให้ข้ามคำสั่งนี้)
ALTER TABLE drrs.tbl_mt_master_plan RENAME COLUMN "desc" TO desc_en;

ALTER TABLE drrs.tbl_mt_master_plan ADD COLUMN IF NOT EXISTS desc_th VARCHAR(255);

-- ตรวจสอบผลลัพธ์หลัง migrate
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'drrs' AND table_name = 'tbl_cus_target'
ORDER BY ordinal_position;

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'drrs' AND table_name = 'tbl_mt_master_plan'
ORDER BY ordinal_position;

SELECT column_name, is_nullable, column_default, data_type
FROM information_schema.columns
WHERE table_schema = 'drrs' AND table_name = 'tbl_account_cus_target'
ORDER BY ordinal_position;
