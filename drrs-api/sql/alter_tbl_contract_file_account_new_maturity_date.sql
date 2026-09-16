-- ============================================================
-- Migration: เพิ่มคอลัมน์ new_maturity_date ใน tbl_contract_file_account
--
-- เก็บ NewMdt (วันครบกำหนด) จาก CBS Inquiry LoanProcess (SubMethod NEXTPLN1) ณ ตอนเซ็นสัญญา
-- ใช้คู่กับ scheduled_next_date ที่มีอยู่แล้ว เพื่อให้บัญชีที่ลงทะเบียนไปแล้ว (isRegistered)
-- โชว์กำหนดชำระของแผนผ่อนชำระได้จาก DB โดยไม่ต้องยิง CBS ซ้ำ (ดู masterPlanService.js)
--
-- รูปแบบ YYYYMMDD (varchar 8) เหมือน scheduled_next_date — ใช้ตรงๆ ไม่คำนวณจาก installment_terms
--
-- ต้อง match กับ entity: drrs-api/src/entities/tblContractFileAccount.js
-- nullable + ADD COLUMN IF NOT EXISTS — ปลอดภัยรันบน DB ที่มีข้อมูลอยู่แล้ว ไม่กระทบแถวเก่า
-- (แถวเก่าจะเป็น NULL = ฝั่งหน้าเว็บซ่อนบรรทัดวันที่)
-- รันไฟล์นี้ครั้งเดียวกับ DB ที่มีตารางนี้อยู่แล้ว
-- ============================================================

ALTER TABLE drrs.tbl_contract_file_account
    ADD COLUMN IF NOT EXISTS new_maturity_date varchar(8) NULL;

COMMENT ON COLUMN drrs.tbl_contract_file_account.new_maturity_date IS
    'วันครบกำหนดจาก CBS Inquiry LoanProcess (NewMdt, SubMethod NEXTPLN1) รูปแบบ YYYYMMDD — snapshot ตอนเซ็นสัญญา ไม่คำนวณจาก installment_terms';

-- ตรวจสอบผลลัพธ์หลัง migrate
SELECT column_name, is_nullable, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'drrs' AND table_name = 'tbl_contract_file_account'
ORDER BY ordinal_position;
