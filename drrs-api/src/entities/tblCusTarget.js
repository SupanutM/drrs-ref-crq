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
            nullable: false
        },
        verifyCode: {
            name: "verify_code",
            type: "varchar",
            length: 4
        },
        birthday: {
            name: "birthday",
            type: "varchar",
            length: 8
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
        totalIncome: {
            name: "total_income",
            type: "numeric",
            nullable: false
        },
        totalCost: {
            name: "total_cost",
            type: "numeric",
            nullable: false
        },
        netIncome: {
            name: "net_income",
            type: "numeric",
            nullable: false
        },
        otherIncome: {
            name: "other_income",
            type: "numeric",
            nullable: false
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