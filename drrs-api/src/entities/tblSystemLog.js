const { EntitySchema } = require("typeorm");

const tblSystemLog = new EntitySchema({
    name: "tbl_system_log",
    tableName: "tbl_system_log",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        step: {
            name: "step",
            type: "varchar",
        },
        controller: {
            name: "controller",
            type: "varchar", //bpchar
        },
        payload: {
            name: "payload",
            type: "text", //bpchar
        },
        responseStatus: {
            name: "response_status",
            type: "varchar", //bpchar
        },
        response: {
            name: "response",
            type: "text", //bpchar
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

module.exports = tblSystemLog;