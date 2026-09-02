const { EntitySchema } = require("typeorm");

/**
 * รายบัญชีที่รวมอยู่ในสัญญาแต่ละฉบับ (1 แถว = 1 บัญชีในสัญญานั้น) — FK ไปที่ tbl_contract_file
 * เก็บ snapshot ของแผน + ข้อมูลจาก CBS Inquiry ณ ตอนเซ็นสัญญาไว้ด้วย (ไม่ใช่แค่ account_no)
 * เพื่อให้ reprint ย้อนหลังได้ตัวเลขตรงกับที่ลูกค้าเซ็นจริง แม้ข้อมูลใน DB ปัจจุบันจะเปลี่ยนไปแล้ว
 *
 * ชื่อ column ฝั่ง CBS (credit_limit, total_amount, balance, accrue_interest, scheduled_next_date)
 * ใช้ชื่อเดียวกับ field ที่ CBS ตอบกลับมา (CreditLimit, TotalAmount, Balance, AccrueInterest,
 * ScheduledNextDate) ตามที่ตกลงกันไว้ — ไม่ map เป็นชื่ออื่น
 *
 * ตาราง: drrs.tbl_contract_file_account
 */
const tblContractFileAccount = new EntitySchema({
    name: "tbl_contract_file_account",
    tableName: "tbl_contract_file_account",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        contractFileId: {
            name: "contract_file_id",
            type: "int",
            nullable: false
        },
        accountNo: {
            name: "account_no",
            type: "varchar",
            length: 20,
            nullable: false
        },
        planNo: {
            name: "plan_no",
            type: "varchar",
            length: 2,
            nullable: false
        },
        // ยอดเงินที่ตกลงจริงตามแผน (ยอดปิดบัญชี หรือ ค่างวด) — จาก tbl_account_cus_target.payment_amount
        paymentAmount: {
            name: "payment_amount",
            type: "numeric",
            nullable: false
        },
        // จำนวนงวด (เดือน) — เฉพาะแผนผ่อนชำระ, null สำหรับแผนปิดบัญชี
        installmentTerms: {
            name: "installment_terms",
            type: "int",
            nullable: true
        },
        // ---- ข้อมูลจาก CBS Inquiry Account ณ ตอนเซ็นสัญญา (ชื่อ column ตรงกับ field ของ CBS) ----
        creditLimit: {
            name: "credit_limit",
            type: "numeric",
            nullable: true
        },
        totalAmount: {
            name: "total_amount",
            type: "numeric",
            nullable: true
        },
        balance: {
            name: "balance",
            type: "numeric",
            nullable: true
        },
        accrueInterest: {
            name: "accrue_interest",
            type: "numeric",
            nullable: true
        },
        scheduledNextDate: {
            name: "scheduled_next_date",
            type: "varchar",
            length: 8,
            nullable: true
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
    },
    relations: {
        contractFile: {
            type: "many-to-one",
            target: "tbl_contract_file",
            joinColumn: { name: "contract_file_id" },
            onDelete: "CASCADE"
        }
    }
});

module.exports = tblContractFileAccount;
