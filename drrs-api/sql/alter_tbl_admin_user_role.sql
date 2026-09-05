-- ============================================================
-- Migration: drrs.tbl_admin_user — เปลี่ยน role ให้ nullable ไม่มี default
-- เหตุผล: เดิมทุกคนที่ login AD สำเร็จครั้งแรกจะได้ role='ADMIN' อัตโนมัติ (ทุกคนนำเข้าข้อมูลได้)
-- เปลี่ยนเป็น: login ใหม่ได้ role=NULL (reprint สัญญาได้อย่างเดียว) ต้องมีคนไป UPDATE role='ADMIN'
-- ให้เองผ่าน SQL ตรงๆ เท่านั้น ไม่มี auto-grant จากระบบอีกต่อไป
-- รันไฟล์นี้ครั้งเดียวกับ DB ที่มีตาราง tbl_admin_user อยู่แล้ว (สร้างไปก่อนหน้านี้)
-- ============================================================

ALTER TABLE drrs.tbl_admin_user ALTER COLUMN role DROP NOT NULL;
ALTER TABLE drrs.tbl_admin_user ALTER COLUMN role DROP DEFAULT;

-- ============================================================
-- ผู้ใช้ที่เคย login ไปแล้วก่อนหน้านี้ (ตอนที่ยังมี auto-grant ADMIN) จะยังมี role='ADMIN' ติดอยู่
-- ถ้าต้องการ reset ทุกคนกลับเป็นผู้ใช้ทั่วไป (ไม่ import ได้) แล้วไปกำหนด ADMIN ใหม่เอง ให้รันคำสั่งนี้
-- (ไม่ auto-run ให้ ต้องเลือกรันเองถ้าต้องการ — ปล่อยเป็น comment ไว้ก่อน)
-- ============================================================
-- UPDATE drrs.tbl_admin_user SET role = NULL WHERE role = 'ADMIN';

-- ตรวจสอบผลลัพธ์หลัง migrate
SELECT username, role, status, last_login_date FROM drrs.tbl_admin_user ORDER BY last_login_date DESC;
