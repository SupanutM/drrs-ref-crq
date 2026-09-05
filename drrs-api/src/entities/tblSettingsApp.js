const { EntitySchema } = require("typeorm");

const tblSettingsApp = new EntitySchema({
    name: "tbl_settings_app",
    tableName: "tbl_settings_app",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        statusFlag: {
            name: "status_flag",
            type: "bool",
            nullable: false
        },
        // ---- ตั้งเวลาเปิด/ปิดระบบอัตโนมัติ ----
        // scheduleFlag = true  -> ใช้ startTime/endTime คำนวณสถานะเปิด/ปิดอัตโนมัติ (ไม่สนใจ statusFlag)
        // scheduleFlag = false -> กลับไปใช้ statusFlag แบบเดิม (เปิด/ปิดด้วยมือ)
        scheduleFlag: {
            name: "schedule_flag",
            type: "bool",
            nullable: false,
            default: false
        },
        startTime: {
            name: "start_time",
            type: "timestamp",
            nullable: true
        },
        endTime: {
            name: "end_time",
            type: "timestamp",
            nullable: true
        },
        channel: {
            name: "channel",
            type: "varchar",
            length: 20
        },
        status: {
            name: "status",
            type: "character", //bpchar
            default: 1
        },
        appVersion: {
            name: "app_version",
            type: "varchar",
            length: 50,
            nullable: true
        },
        createdDate: {
            name: "created_date",
            type: "timestamp",
            createDate: true,
            default: () => "CURRENT_TIMESTAMP"
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
        }
        ,
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

module.exports = tblSettingsApp;