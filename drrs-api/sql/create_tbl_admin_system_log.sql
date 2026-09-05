-- ============================================================
-- ตาราง: drrs.tbl_admin_system_log
-- Audit log แยกสำหรับฝั่ง admin เท่านั้น (login, import master/target data, reprint สัญญา)
-- แยกจาก drrs.tbl_system_log (ของฝั่งลูกค้า) โดยเจตนา — ไม่อยากให้ log ปนกัน
-- ต้อง match กับ entity: drrs-api/src/entities/tblAdminSystemLog.js
-- ============================================================

CREATE TABLE IF NOT EXISTS drrs.tbl_admin_system_log (
    id                 SERIAL PRIMARY KEY,
    step               VARCHAR(255),
    controller         VARCHAR(255),
    payload            TEXT,
    response_status    VARCHAR(255),
    response           TEXT,
    created_date       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         VARCHAR(255) DEFAULT 'DRRS',
    update_date        TIMESTAMP,
    update_by          VARCHAR(255),
    delete_date        TIMESTAMP,
    delete_by          VARCHAR(255)
);

COMMENT ON TABLE drrs.tbl_admin_system_log IS 'Audit log ของหน้า admin (login, import, reprint) แยกจาก tbl_system_log ของลูกค้า';
