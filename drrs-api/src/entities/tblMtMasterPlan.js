const { EntitySchema } = require("typeorm");

const tblMtMasterPlan = new EntitySchema({
    name: "tbl_mt_master_plan",
    tableName: "tbl_mt_master_plan",
    columns: {
        code: {
            primary: true,
            type: "varchar",
            generated: false
        },
        // คำอธิบายแผนภาษาอังกฤษ (เดิมชื่อ column/field ว่า "desc" — เปลี่ยนเป็น desc_en
        // ให้ตรงคู่กับ desc_th อย่างชัดเจน ไม่กำกวมว่า desc เดิมเป็นภาษาไหน)
        descEn: {
            name: "desc_en",
            type: "varchar",
            nullable: false
        },
        // คำอธิบายแผนภาษาไทย — เพิ่มตามไฟล์ import รูปแบบใหม่
        descTh: {
            name: "desc_th",
            type: "varchar",
            nullable: true
        },
        status: {
            name: "status",
            type: "character", //bpchar
            default: 1
        },
        isCheckIncome: {
            name: "is_check_income",
            type: "character", // 1 = Check, 0 = Skip
            length: 1,
            default: '1',
            nullable: true
        },
        loanType: {
            name: "loan_type",
            type: "varchar",
            length: 2,
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

module.exports = tblMtMasterPlan;