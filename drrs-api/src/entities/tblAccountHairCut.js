const { EntitySchema } = require("typeorm");

const tblAccountHairCut = new EntitySchema({
    name: "tbl_account_hair_cut",
    tableName: "tbl_account_hair_cut",
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
        planNo: {
            name: "plan_no",
            type: "varchar",
            length: 20
        },
        amount: {
            name: "amount",
            type: "float8",
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
            // default: () => "CURRENT_TIMESTAMP"
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
    }
});

module.exports = tblAccountHairCut;