-- ============================================================
-- ตาราง: drrs.tbl_admin_user
-- ผู้ใช้งานฝั่ง admin — ยืนยันตัวตนผ่าน Active Directory (AD)
-- ไม่เก็บ password ในตารางนี้ (bind กับ AD ทุกครั้งที่ login)
-- แถวถูกสร้าง/อัปเดตอัตโนมัติจากฝั่ง backend ตอน login AD สำเร็จครั้งแรก
-- ต้อง match กับ entity: drrs-api/src/entities/tblAdminUser.js
-- ============================================================

CREATE TABLE IF NOT EXISTS drrs.tbl_admin_user (
    id                 SERIAL PRIMARY KEY,
    username           VARCHAR(50) NOT NULL,
    display_name       VARCHAR(100),
    email              VARCHAR(100),
    role               VARCHAR(20), -- NULL = ผู้ใช้ทั่วไป (reprint เท่านั้น), 'ADMIN' = import ได้, 'SUPERADMIN' = ADMIN + จัดการสิทธิ์ผู้ใช้อื่นได้ — กำหนดเองผ่าน SQL หรือหน้า user-management เท่านั้น ไม่มี auto-grant
    status             CHARACTER(1) NOT NULL DEFAULT '1', -- '1' = ใช้งานได้, '0' = ถูกระงับ
    last_login_date    TIMESTAMPTZ,
    created_date       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         VARCHAR(20) NOT NULL DEFAULT 'DRRS',
    update_date        TIMESTAMPTZ,
    update_by          VARCHAR(20),
    delete_date        TIMESTAMPTZ,
    delete_by          VARCHAR(20),
    CONSTRAINT uq_tbl_admin_user_username UNIQUE (username)
);

COMMENT ON TABLE drrs.tbl_admin_user IS 'ผู้ใช้งานฝั่ง admin ยืนยันตัวตนผ่าน AD ไม่เก็บ password';

-- ============================================================
-- ให้สิทธิ์ ADMIN (นำเข้าข้อมูลได้) กับผู้ใช้ที่ต้องการ
-- รันคำสั่งด้านล่างนี้เอง แทน <username> ด้วย username จริง
-- (หรือใช้หน้า /drrs/admin/user-management ถ้ามี SUPERADMIN คนแรกอยู่แล้ว)
-- ============================================================
-- UPDATE drrs.tbl_admin_user SET role = 'ADMIN', update_by = 'DBA', update_date = NOW()
-- WHERE username = '<username>';

-- ============================================================
-- ถอดสิทธิ์ ADMIN กลับเป็นผู้ใช้ทั่วไป (reprint เท่านั้น)
-- ============================================================
-- UPDATE drrs.tbl_admin_user SET role = NULL, update_by = 'DBA', update_date = NOW()
-- WHERE username = '<username>';

-- ============================================================
-- Bootstrap SUPERADMIN คนแรกของระบบ (ต้องรันด้วย SQL ตรงๆ เท่านั้น — หน้า user-management
-- ต้องมี SUPERADMIN อยู่แล้วถึงจะเข้าได้ ไก่กับไข่ ใครมาก่อนก็ต้องตั้งเองครั้งแรกผ่าน SQL นี้)
-- ถ้า username นี้ยังไม่มีแถวในตาราง ให้ INSERT ใหม่แทน (uncomment บรรทัด INSERT ด้านล่าง)
-- ============================================================
-- UPDATE drrs.tbl_admin_user SET role = 'SUPERADMIN', update_by = 'DBA', update_date = NOW()
-- WHERE username = '<username>';

-- INSERT INTO drrs.tbl_admin_user (username, display_name, role, status, created_by)
-- VALUES ('<username>', '<display_name>', 'SUPERADMIN', '1', 'DBA');
