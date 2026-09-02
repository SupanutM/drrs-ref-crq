const { EntitySchema } = require("typeorm");

const tblAccountCusTarget = new EntitySchema({
    name: "tbl_account_cus_target",
    tableName: "tbl_account_cus_target",
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
        accountNo: {
            name: "account_no",
            type: "varchar",
            length: 20,
            nullable: false
        },
        planNo: {
            name: "plan_no",
            type: "varchar",
            length: 20,
            nullable: false
        },
        status: {
            name: "status",
            type: "character", // bpchar(1)
            length: 1,
            default: '1'
        },
        minAmount: {
            name: "min_amount",
            type: "numeric",
            nullable: true
        },
        maxAmount: {
            name: "max_amount",
            type: "numeric",
            nullable: false,
            default: 0
        },
        paymentAmount: {
            name: "payment_amount",
            type: "numeric",
            nullable: true
        },
        installmentTerms: {
            name: "installment_terms",
            type: "int",
            nullable: true
        },
        startDate: {
            name: "start_date",
            type: "date",
            nullable: true
        },
        endDate: {
            name: "end_date",
            type: "date",
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
            nullable: true,
            updateDate: true
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
            nullable: true,
            deleteDate: true
        },
        deleteBy: {
            name: "delete_by",
            type: "varchar",
            length: 20,
            nullable: true
        }
    },
    relations: {
        cusTarget: {
            target: "tbl_cus_target",
            type: "many-to-one",
            joinColumn: {
                name: "cus_target_id"
            },
            onDelete: "CASCADE"
        }
    }
});

module.exports = tblAccountCusTarget;
