// seed-loadtest-runner.js — รัน seed SQL ผ่าน Node.js (ไม่ต้องติดตั้ง psql)
// Usage: node loadtest/seed-loadtest-runner.js
//   ค่า DB อ่านจาก .env.uat  (เหมือน script loadtest อื่น ๆ)
//   ถ้าต้องการชี้ .env อื่น:  DB_ENV=../.env node loadtest/seed-loadtest-runner.js

const path = require("path");
const fs = require("fs");
const { Client } = require("pg");

// ─── config ──────────────────────────────────────────────────────────────────
const envFile = process.env.DB_ENV || ".env.uat";
require("dotenv").config({ path: path.join(__dirname, "..", envFile) });

const sqlPath = path.join(__dirname, "seed-loadtest-data.sql");

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    await client.connect();
    console.log(`✅ Connected to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // อ่าน SQL file
    const sql = fs.readFileSync(sqlPath, "utf8");

    // ตัด comment-only lines ออก แล้ว split ตาม ";" เพื่อรันทีละ statement
    // แต่ CTE ใน script เป็น statement เดียว (BEGIN → big CTE INSERT → COMMIT → VERIFY)
    // ง่ายสุดคือส่งทั้ง file ไป — pg driver รองรับ multi-statement ใน query()
    const start = Date.now();
    const res = await client.query(sql);

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    // res อาจเป็น array ของ results (multi-statement)
    const results = Array.isArray(res) ? res : [res];
    const verify = results[results.length - 1]; // ผลลัพธ์สุดท้าย = VERIFY query

    console.log(`\n🚀 Seed completed in ${elapsed}s`);
    console.log("─".repeat(45));

    if (verify && verify.rows) {
      verify.rows.forEach((r) => {
        console.log(`  ${r.tbl.padEnd(28)} ${Number(r.cnt).toLocaleString()} rows`);
      });
    }

    // สรุป rowCount ของแต่ละ statement
    results.forEach((r, i) => {
      if (r.command && r.command !== "SELECT") {
        console.log(`  [${i}] ${r.command} → ${r.rowCount ?? "-"} rows`);
      }
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.detail) console.error("   Detail:", err.detail);
    if (err.hint) console.error("   Hint:", err.hint);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
