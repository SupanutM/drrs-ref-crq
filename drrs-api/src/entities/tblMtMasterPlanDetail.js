const { EntitySchema } = require("typeorm");

const tblMtMasterPlanDetail = new EntitySchema({
    name: "tbl_mt_master_plan_detail",
    tableName: "tbl_mt_master_plan_detail",
    columns: {
        planCode: {
            primary: true,
            name: "plan_code",
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

module.exports = tblMtMasterPlanDetail;