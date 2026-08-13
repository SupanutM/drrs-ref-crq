const { EntitySchema } = require("typeorm");

const tblAccountInstallment = new EntitySchema({
    name: "tbl_account_installment",
    tableName: "tbl_account_installment",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        cusTargetId: {
            name: "cus_target_id",
            type: "int",
        },
        accountNo: {
            name: "account_no",
            type: "varchar",
            length: 20
        },
        principal: {
            name: "principal",
            type: "varchar",
            length: 20
        },
        installmentAmount: {
            name: "installment_amount",
            type: "numeric",
            precision: 20,
            scale: 5,
            nullable: true
        },
        interest: {
            name: "interest",
            type: "numeric",
            precision: 8,
            scale: 5,
            nullable: true
        },
        installmentTerm: {
            name: "installment_term",
            type: "numeric",
            precision: 20,
            scale: 5,
            nullable: true
        },
        installmentFrequency: {
            name: "installment_frequency",
            type: "numeric",
            precision: 20,
            scale: 5,
            nullable: true
        },
        status: {
            name: "status",
            type: "character", //bpchar
            default: 1
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
            default: "system"
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
    }
});

module.exports = tblAccountInstallment;