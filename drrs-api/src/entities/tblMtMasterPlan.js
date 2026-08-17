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
        desc: {
            name: "desc",
            type: "varchar",
            nullable: false
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
            default: "system"
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