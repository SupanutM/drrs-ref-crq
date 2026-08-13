const { EntitySchema } = require("typeorm");

const tblTemplateCondition = new EntitySchema({
    name: "tbl_template_condition",
    tableName: "tbl_template_condition",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        xml_template: {
            name: "xml_template",
            type: "text",
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
    }
});

module.exports = tblTemplateCondition;