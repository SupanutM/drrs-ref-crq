const { EntitySchema } = require("typeorm");

const tblMtProvince = new EntitySchema({
    name: "tbl_mt_province",
    tableName: "tbl_mt_province",
    columns: {
        lang: {
            primary: true,
            type: "varchar",
            length: 2,
            generated: false
        },
        provinceCode: {
            primary: true,
            name: "province_code",
            type: "varchar",
            length: 2,
            generated: false
        },
        provinceName: {
            name: "province_name",
            type: "varchar",
            length: 50,
            nullable: false
        },
        status: {
            name: "status",
            type: "character", // bpchar
            length: 1,
            nullable: false,
            default: '1'
        },
        createdDate: {
            name: "created_date",
            type: "timestamp",
            createDate: true,
            nullable: false,
            default: () => "CURRENT_TIMESTAMP"
        },
        createdBy: {
            name: "created_by",
            type: "varchar",
            length: 20,
            nullable: false
        },
        updateDate: {
            name: "update_date",
            type: "timestamp",
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
            type: "timestamp",
            nullable: true
        },
        deleteBy: {
            name: "delete_by",
            type: "varchar",
            length: 20,
            nullable: true
        }
    }
});

module.exports = tblMtProvince;
