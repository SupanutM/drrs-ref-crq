/**
 * helper คุย PostgreSQL ตัวจริง สำหรับชุดเทสต์ที่ยิง backend จริง
 *
 * ใช้ 2 อย่าง:
 *  1. snapshot / restore ตารางที่ flow ไปแก้ (กันข้อมูล dev เพี้ยนหลังรันเทสต์)
 *  2. ตรวจว่าสิ่งที่บันทึกลง DB ถูกต้องจริง (ไม่ใช่เชื่อแค่ response)
 *
 * หมายเหตุเรื่อง dependency: โปรเจกต์ frontend ไม่ได้ลง `pg` ไว้
 * เราจึงยืม module จาก drrs-api (ซึ่งมี pg เป็น dependency อยู่แล้ว)
 * เพื่อไม่ต้องเพิ่ม dependency ให้ frontend เพียงเพื่อรันเทสต์
 */
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "..", "..", "drrs-api");

/** โหลดไฟล์ .env แบบง่าย (ไม่พึ่ง dotenv เพื่อลด dependency) */
function parseEnvFile(filePath) {
  /** @type {Record<string,string>} */
  const result = {};
  if (!fs.existsSync(filePath)) return result;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** ค่า config ของ DB — อ่านจาก drrs-api/.env (ไม่ต้องตั้งค่าซ้ำ) */
function getDbConfig() {
  const env = { ...parseEnvFile(path.join(API_DIR, ".env")), ...process.env };
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    schema: env.DB_SCHEMA,
  };
}

/** ข้อมูลลูกค้าที่ใช้ล็อกอิน — ต้องมาจาก env/ไฟล์ local เท่านั้น ห้าม hardcode ลง repo */
function getTestIdentity() {
  const local = parseEnvFile(path.join(__dirname, "..", "..", ".env.e2e"));
  const env = { ...local, ...process.env };
  return {
    firstName: env.E2E_FIRST_NAME,
    lastName: env.E2E_LAST_NAME,
    verifyCode: env.E2E_VERIFY_CODE,
    accountNo: env.E2E_ACCOUNT_NO,
  };
}

function loadPg() {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(API_DIR, "node_modules", "pg"));
  } catch (err) {
    throw new Error(
      `ไม่พบ module "pg" ที่ ${API_DIR}\\node_modules\\pg — ` +
        `ให้รัน npm install ในโฟลเดอร์ drrs-api ก่อน (${err.message})`
    );
  }
}

/** เปิด client ที่ต่อ DB จริง (ผู้เรียกต้องปิดเองด้วย client.end()) */
async function connect() {
  const { Client } = loadPg();
  const cfg = getDbConfig();
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
  });
  await client.connect();
  return client;
}

/** รัน query สั้นๆ แล้วปิด connection ให้เลย */
async function query(sql, params = []) {
  const client = await connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

const SCHEMA = getDbConfig().schema;
const BACKUP_SCHEMA = `${SCHEMA}_e2e_bak`;

/** ตารางที่ flow การลงทะเบียนไปเขียนทับ — ต้อง snapshot ก่อนรันเทสต์ */
const MUTATED_TABLES = [
  "tbl_settings_step",
  "tbl_account_hair_cut",
  "tbl_account_installment",
  "tbl_cus_target",
];

/** ตารางที่คืนค่าด้วยการลบแล้ว insert กลับได้ (ไม่มีใครอ้าง FK มาที่มัน) */
const REPLACE_TABLES = [
  "tbl_account_hair_cut",
  "tbl_account_installment",
  "tbl_settings_step",
];

/**
 * คืนสถานะตารางที่ flow ไปเขียน ให้กลับไปเท่าตอน snapshot
 *
 * ใช้ 2 ที่:
 *  - global-teardown (คืนค่าตอนจบทั้งชุด)
 *  - beforeEach ของเทสต์ (ให้แต่ละเทสต์เริ่มจากสถานะเดียวกัน ไม่พันกัน)
 *
 * tbl_cus_target ใช้ UPDATE เพราะมี FK จาก tbl_account_cus_target ชี้อยู่ ลบไม่ได้
 */
async function restoreMutableState() {
  const client = await connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [BACKUP_SCHEMA]
    );
    if (exists.rowCount === 0) {
      throw new Error(
        `ไม่พบ schema สำรอง ${BACKUP_SCHEMA} — global-setup อาจไม่ได้ทำงาน`
      );
    }

    await client.query("BEGIN");
    for (const table of REPLACE_TABLES) {
      await client.query(`DELETE FROM ${SCHEMA}.${table}`);
      await client.query(
        `INSERT INTO ${SCHEMA}.${table} SELECT * FROM ${BACKUP_SCHEMA}.${table}`
      );
    }
    await client.query(`
      UPDATE ${SCHEMA}.tbl_cus_target AS t
         SET email        = b.email,
             birthday     = b.birthday,
             tel_no       = b.tel_no,
             address      = b.address,
             total_income = b.total_income,
             other_income = b.other_income,
             total_cost   = b.total_cost,
             net_income   = b.net_income,
             update_date  = b.update_date,
             update_by    = b.update_by
        FROM ${BACKUP_SCHEMA}.tbl_cus_target AS b
       WHERE t.id = b.id
    `);
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = {
  SCHEMA,
  BACKUP_SCHEMA,
  MUTATED_TABLES,
  REPLACE_TABLES,
  connect,
  query,
  getDbConfig,
  getTestIdentity,
  parseEnvFile,
  restoreMutableState,
};
