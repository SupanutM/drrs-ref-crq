const { EntitySchema } = require("typeorm");

const tblSettingsStep = new EntitySchema({
    name: "tbl_settings_step",
    tableName: "tbl_settings_step",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        accountNo: {
            name: "account_no",
            type: "varchar",
            unique: true,
        },
        stepVerifyTarget: {
            name: "step_verify_target",
            type: "character", //bpchar
            default: '0'
        },
        stepVerifyLaser: {
            name: "step_verify_laser",
            type: "character", //bpchar
            default: '0'
        },
        stepViewPlan: {
            name: "step_view_plan",
            type: "character", //bpchar
            default: '0'
        },
        stepConfirmPlan: {
            name: "step_confirm_plan",
            type: "character", //bpchar
            default: '0'
        },
        stepSendToCbs: {
            name: "step_send_to_cbs",
            type: "character", //bpchar
            default: '0'
        },
        stepSendMail: {
            name: "step_send_mail",
            type: "varchar", //bpchar
            default: ""
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
            nullable: true,
            updateDate: true
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

module.exports = tblSettingsStep;