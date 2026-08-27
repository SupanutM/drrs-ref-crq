const env = require('../config/env')
const { DataSource } = require("typeorm");
const DbLogger = require("../utils/dbLogger");
const tblSettingsApp = require("../../src/entities/tblSettingsApp");
const tblCusTarget = require("../../src/entities/tblCusTarget");
const tblAccountCusTarget = require("../../src/entities/tblAccountCusTarget");

const tblAccountHairCut = require("../../src/entities/tblAccountHairCut");
const tblAccountInstallment = require("../../src/entities/tblAccountInstallment");
const tblMtMasterPlan = require("../../src/entities/tblMtMasterPlan");
const tblMtMasterPlanDetail = require("../../src/entities/tblMtMasterPlanDetail");
const tblMtProvince = require("../../src/entities/tblMtProvince");
const tblMtDistrict = require("../../src/entities/tblMtDistrict");
const tblMtSubDistrict = require("../../src/entities/tblMtSubDistrict");
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
    synchronize: false,  // ไม่ให้ TypeORM แก้โครงสร้างตารางเอง (ต้องเป็น false บน Production)

    // ใช้ logger ของเราเอง เพื่อไม่ให้ค่า parameters (ชื่อ-นามสกุลลูกค้าที่ถอดรหัสแล้ว)
    // หลุดลงไฟล์ log — การเปิด/ปิด query log อยู่ใน DbLogger ทั้งหมด
    // จึงตั้ง logging: true ไว้ให้ TypeORM เรียก logger ทุก event
    // เปิด query log กลับได้โดยไม่ต้องแก้โค้ด: ตั้ง DB_LOG_QUERIES=true ใน .env
    logger: new DbLogger({ logQueries: env.dbLogQueries }),
    logging: true,

    // query ที่ใช้เวลาเกินค่านี้จะถูก log เป็น warn (ไว้ตามหาคอขวด — ของใหม่ ก่อนหน้านี้ไม่มี)
    maxQueryExecutionTime: env.dbSlowQueryMs,

    // ---- connection pool ----
    // ก่อนแก้: ไม่ได้ตั้งไว้เลย pg จึงใช้ค่า default max = 10
    // ผล load test 0.9.5 (POST /api/checkCloseSystem):
    //   20 req/s -> p50 23ms  p95 35ms
    //   50 req/s -> p50 24ms  p95 125ms
    //  100 req/s -> p50 1001ms p95 2921ms  <- พัง ทุกคนรอ ไม่ใช่แค่บางคน
    poolSize: env.dbPoolMax,                // -> pg max
    connectTimeoutMS: env.dbConnTimeoutMs,  // -> pg connectionTimeoutMillis
    extra: {
        idleTimeoutMillis: env.dbIdleTimeoutMs,
    },

    entities: [
        tblSettingsApp,
        tblCusTarget,
        tblAccountCusTarget,

        tblAccountHairCut,
        tblAccountInstallment,
        tblMtMasterPlan,
        tblMtMasterPlanDetail,
        tblMtProvince,
        tblMtDistrict,
        tblMtSubDistrict,
        tblTemplateCondition,
        tblSystemLog,
        tblSettingsStep
    ],
});

module.exports = { AppDataSource };
