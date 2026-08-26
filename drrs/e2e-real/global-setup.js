/**
 * Global setup ของชุดเทสต์ที่ยิง backend จริง
 *
 * 1. ตรวจว่าพร้อมรันจริง (backend ตอบ, DB ต่อได้, มีข้อมูลล็อกอิน) — ถ้าไม่พร้อมให้ fail ทันที
 *    พร้อมบอกวิธีแก้ ไม่ปล่อยให้เทสต์ fail แบบงงๆ
 * 2. สำรองตารางที่ flow จะไปเขียนทับ เพื่อคืนค่าให้เหมือนเดิมตอนจบ (global-teardown)
 */
const http = require("http");
const {
  SCHEMA,
  BACKUP_SCHEMA,
  MUTATED_TABLES,
  connect,
  getTestIdentity,
} = require("./helpers/db");

const BACKEND = "http://localhost:5000";

function postJson(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        host: "localhost",
        port: 5000,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: 15000,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode, raw }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, raw: "timeout" });
    });
    req.on("error", (e) => resolve({ status: 0, raw: e.message }));
    req.write(data);
    req.end();
  });
}

module.exports = async () => {
  // ---------- 1. ตรวจความพร้อม ----------
  const identity = getTestIdentity();
  const missing = ["firstName", "lastName", "verifyCode"].filter((k) => !identity[k]);
  if (missing.length > 0) {
    throw new Error(
      [
        "",
        "ไม่มีข้อมูลลูกค้าสำหรับล็อกอินเข้าเทสต์ backend จริง",
        `ขาด: ${missing.join(", ")}`,
        "",
        "วิธีแก้: สร้างไฟล์ drrs/.env.e2e (ไฟล์นี้ถูก gitignore ไว้แล้ว) ตามตัวอย่างใน",
        "drrs/.env.e2e.example แล้วใส่ค่าที่ตรงกับ tbl_cus_target ใน DB ของคุณ",
        "",
      ].join("\n")
    );
  }

  const health = await postJson("/api/checkCloseSystem", { channel: "DRRS" });
  if (health.status !== 200) {
    throw new Error(
      [
        "",
        `เรียก backend ที่ ${BACKEND} ไม่ได้ (status: ${health.status} ${health.raw})`,
        "",
        "วิธีแก้: เปิด backend ก่อนรันเทสต์",
        "  cd drrs-api && npm run dev",
        "",
      ].join("\n")
    );
  }

  let closeBody;
  try {
    closeBody = JSON.parse(health.raw);
  } catch (_) {
    closeBody = null;
  }
  if (!closeBody?.data?.[0]?.status_flag) {
    throw new Error(
      "backend ตอบว่าระบบปิดใช้งาน (status_flag = false) — เทสต์ flow ลงทะเบียนไม่ได้\n" +
        `แก้ที่ตาราง ${SCHEMA}.tbl_settings_app ให้ status_flag = true`
    );
  }

  // ---------- 2. สำรองข้อมูล ----------
  const client = await connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${BACKUP_SCHEMA}`);
    for (const table of MUTATED_TABLES) {
      await client.query(`DROP TABLE IF EXISTS ${BACKUP_SCHEMA}.${table}`);
      await client.query(
        `CREATE TABLE ${BACKUP_SCHEMA}.${table} AS SELECT * FROM ${SCHEMA}.${table}`
      );
    }
    console.log(
      `[e2e-real] สำรองข้อมูล ${MUTATED_TABLES.length} ตารางไว้ที่ schema ${BACKUP_SCHEMA} แล้ว`
    );
  } finally {
    await client.end();
  }
};
