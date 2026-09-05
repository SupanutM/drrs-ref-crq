const { EntitySchema } = require("typeorm");

const tblCusTarget = new EntitySchema({
    name: "tbl_cus_target",
    tableName: "tbl_cus_target",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        citizenId: {
            name: "citizen_id",
            type: "varchar",
            length: 13,
            nullable: false
        },
        cifNo: {
            name: "cif_no",
            type: "varchar",
            length: 20,
            nullable: true
        },
        address: {
            name: "address",
            type: "text",
            nullable: true
        },
        firstName: {
            name: "first_name",
            type: "varchar",
            length: 50
        },
        lastName: {
            name: "last_name",
            type: "varchar",
            length: 50
        },
        telNo: {
            name: "tel_no",
            type: "varchar",
            length: 10,
            // เดิม nullable:false — ไฟล์ import ข้อมูลลูกค้ารูปแบบใหม่ (.csv pipe-delimited) ไม่มี
            // คอลัมน์นี้ส่งมาแล้ว (ลูกค้ากรอกเบอร์เองทีหลังตอนหน้า FormRegister ผ่าน updateCusTargetService)
            nullable: true
        },
        verifyCode: {
            name: "verify_code",
            type: "varchar",
            length: 4
        },
        birthday: {
            name: "birthday",
            type: "varchar",
            length: 8,
            // ไฟล์ import ใหม่ไม่มีคอลัมน์นี้ — ค่าจะถูกกรอกทีหลังในขั้นตอนอื่นของ flow
            nullable: true
        },
        email: {
            name: "email",
            type: "varchar",
            nullable: true
        },
        status: {
            name: "status",
            type: "character", //bpchar
            default: 1
        },
        // ประเภทลูกค้า (ตามไฟล์ import ใหม่ คอลัมน์ที่ 6) — ยังไม่มี business rule ตายตัว
        // เก็บค่าดิบจากไฟล์ไว้ก่อน
        type: {
            name: "type",
            type: "varchar",
            length: 10,
            nullable: true
        },
        totalIncome: {
            name: "total_income",
            type: "numeric",
            // ไฟล์ import ใหม่ไม่มีคอลัมน์นี้ — ปล่อย nullable แทนบังคับกรอก
            nullable: true
        },
        totalCost: {
            name: "total_cost",
            type: "numeric",
            nullable: true
        },
        netIncome: {
            name: "net_income",
            type: "numeric",
            nullable: true
        },
        otherIncome: {
            name: "other_income",
            type: "numeric",
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
        }
        ,
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
    },
    relations: {
        accounts: {
            target: "tbl_account_cus_target",
            type: "one-to-many",
            inverseSide: "cusTarget",
            cascade: true
        }
    }
});

module.exports = tblCusTarget;