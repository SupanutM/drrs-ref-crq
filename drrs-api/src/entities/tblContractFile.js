const { EntitySchema } = require("typeorm");

/**
 * เก็บไฟล์สัญญา (PDF, base64 ไม่เข้ารหัส = preview) ไว้สำหรับ reprint ย้อนหลัง
 * 1 แถว = 1 สัญญา (1 ครั้งกดยอมรับ) — ไม่แยกแถวตามบัญชี แม้สัญญามีหลายบัญชีรวมอยู่
 * รายชื่อบัญชี + ข้อมูล snapshot ของแต่ละบัญชี อยู่ที่ tbl_contract_file_account (normalize แล้ว)
 * ตาราง: drrs.tbl_contract_file
 */
const tblContractFile = new EntitySchema({
    name: "tbl_contract_file",
    tableName: "tbl_contract_file",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        cusTargetId: {
            name: "cus_target_id",
            type: "int",
            nullable: false
        },
        fileName: {
            name: "file_name",
            type: "varchar",
            length: 100,
            nullable: false
        },
        // ไฟล์ PDF เวอร์ชัน preview (ไม่เข้ารหัส) เก็บเป็น base64 — ใช้ reprint/เปิดดูย้อนหลังได้โดยไม่ต้องรู้วันเกิดลูกค้า
        base64Content: {
            name: "base64_content",
            type: "text",
            nullable: false
        },
        createdDate: {
            name: "created_date",
            type: "timestamp with time zone",
            createDate: true,
            default: () => "CURRENT_TIMESTAMP"
        },
        createdBy: {
            name: "created_by",
            type: "varchar",
            length: 20,
            default: "DRRS"
        },
        updateDate: {
            name: "update_date",
            type: "timestamp with time zone",
            nullable: true
        },
        updateBy: {
            name: "update_by",
            type: "varchar",
            length: 20,
            nullable: true
        },
        deleteDate: {
            name: "delete_date",
            type: "timestamp with time zone",
            nullable: true
        },
        deleteBy: {
            name: "delete_by",
            type: "varchar",
            length: 20,
            nullable: true
        }
    }
});

module.exports = tblContractFile;
