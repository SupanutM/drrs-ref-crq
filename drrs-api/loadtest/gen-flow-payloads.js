// สร้าง verify payload (เข้ารหัสแล้ว) ล่วงหน้าเป็นไฟล์ ให้ k6 อ่าน (k6 ทำ AES-GCM เองไม่ได้)
// แต่ละราย = 1 loadtest customer (last_name loadtest-NNNNN) ใช้ยิงได้ครั้งเดียว
//
// ปรับจำนวนผ่าน env: FROM (เริ่ม seq), COUNT (จำนวนราย)
//   node gen-flow-payloads.js  -> default seq 2..10000
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.uat") });
const fs = require("fs");
const cryptoUtil = require("../src/utils/crypto");

const KEY = process.env.CRYPTO_KEY;
const enc = (v) => { const e = cryptoUtil.encryptGCM(String(v), KEY); return `${e.iv}:${e.encrypted}:${e.tag}`; };

const FROM = Number(process.env.FROM || 2);        // seq 1 ถูกใช้ไปแล้ว (ถูก block)
const COUNT = Number(process.env.COUNT || 9999);   // ที่เหลือถึง 10000

const rows = [];
for (let i = 0; i < COUNT; i++) {
  const seq = FROM + i;
  rows.push({
    seq,
    verifyCode: "0000",
    citizenId: enc(String(seq).padStart(13, "0")),
    name: enc("ทดสอบ"),
    surname: enc("loadtest-" + String(seq).padStart(5, "0")),
    dateOfBirth: "20000101",
    laserCardId: enc("JT0000000000"),
    email: enc("loadtest@example.com"),
    telNo: enc("0800000000"),
  });
}

fs.writeFileSync(__dirname + "/flow-payloads.json", JSON.stringify(rows));
fs.writeFileSync(__dirname + "/genflow.txt", `สร้าง ${rows.length} payloads (seq ${FROM}..${FROM + COUNT - 1})\n`);
