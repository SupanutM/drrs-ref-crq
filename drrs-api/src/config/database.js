const env = require('../config/env')
const { DataSource } = require("typeorm");
const tblSettingsApp = require("../../src/entities/tblSettingsApp");
const tblCusTarget = require("../../src/entities/tblCusTarget");
const tblAccountCusTarget = require("../../src/entities/tblAccountCusTarget");

const tblAccountHairCut = require("../../src/entities/tblAccountHairCut");
const tblAccountInstallment = require("../../src/entities/tblAccountInstallment");
const tblMtMasterPlan = require("../../src/entities/tblMtMasterPlan");
const tblMtMasterPlanDetail = require("../../src/entities/tblMtMasterPlanDetail");
const tblTemplateCondition = require("../../src/entities/tblTemplateCondition");
const tblSystemLog = require("../../src/entities/tblSystemLog");
const tblSettingsStep = require("../../src/entities/tblSettingsStep");

const AppDataSource = new DataSource({
    type: env.dbType,
    host: env.dbHost,
    port: env.dbPort,
    username: env.dbUser,
    password: env.dbPass,
    database: env.dbName,
    schema: env.dbSchema,
    synchronize: false,  // ให้ TypeORM สร้างตารางให้อัตโนมัติ (ควรปรับเป็น false บน Production)
    logging: true,
    entities: [
        tblSettingsApp,
        tblCusTarget,
        tblAccountCusTarget,

        tblAccountHairCut,
        tblAccountInstallment,
        tblMtMasterPlan,
        tblMtMasterPlanDetail,
        tblTemplateCondition,
        tblSystemLog,
        tblSettingsStep
    ],
});

module.exports = { AppDataSource };
