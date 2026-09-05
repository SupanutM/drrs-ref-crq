const { EntitySchema } = require("typeorm");

/**
 * Audit log แยกสำหรับฝั่ง admin เท่านั้น (login, import master/target data, reprint สัญญา)
 * แยกจาก tbl_system_log (ของฝั่งลูกค้า) โดยเจตนา — ไม่อยากให้ log 2 ฝั่งปนกัน
 * (ระบบธนาคาร อยากตรวจสอบ privileged action ของ admin ได้ง่ายแยกจาก log ปริมาณมากของลูกค้า)
 * โครงสร้างคอลัมน์เหมือน tbl_system_log ทุกอย่าง ต่างกันแค่ชื่อตาราง
 * ตาราง: drrs.tbl_admin_system_log
 */
const tblAdminSystemLog = new EntitySchema({
    name: "tbl_admin_system_log",
    tableName: "tbl_admin_system_log",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        step: {
            name: "step",
            type: "varchar",
        },
        controller: {
            name: "controller",
            type: "varchar",
        },
        payload: {
            name: "payload",
            type: "text",
        },
        responseStatus: {
            name: "response_status",
            type: "varchar",
        },
        response: {
            name: "response",
            type: "text",
        },
        createdDate: {
            name: "created_date",
            type: "timestamp",
            createDate: true,
        },
        createdBy: {
            name: "created_by",
            type: "varchar",
            default: "DRRS"
        },
        updateDate: {
            name: "update_date",
            type: "timestamp",
            nullable: true
        },
        updateBy: {
            name: "update_by",
            type: "varchar",
            nullable: true
        },
        deleteDate: {
            name: "delete_date",
            type: "timestamp",
            nullable: true
        },
        deleteBy: {
            name: "delete_by",
            type: "varchar",
            nullable: true
        }
    }
});

module.exports = tblAdminSystemLog;
