// ============================================================
// k6 Load Test — UAT (read-only เท่านั้น)
//
// ยิง 2 เส้นที่ตรวจแล้วว่าใช้งานได้จริงบน UAT และปลอดภัย:
//   1. POST /api/checkCloseSystem  — อ่าน tbl_settings_app (แตะ DB แบบอ่าน)
//   2. POST /utils/encryption      — เข้ารหัส AES-GCM (กิน CPU ไม่แตะ DB)
//      เส้นนี้อยู่บน hot path จริง: กรอกฟอร์ม 1 ครั้ง frontend เรียก 6 รอบ
//
// ไม่แตะ:
//   - /api/verify-register  (จะยิง DOPA API จริง ถ้า UAT ไม่ได้ตั้ง LOAD_TEST_MODE=true)
//   - เส้นที่เขียน DB ทุกเส้น (debt-restructure, update-income, cancel-plan)
//   - /api/generate-contract, /api/generate-pdf (เปิด Chromium ต่อ request)
//   - /api/master/provinces (ตอนนี้ตอบ 500 บน UAT — ต้องแก้ก่อน)
//
// ------------------------------------------------------------
// วิธีรัน — เริ่มเบาก่อนเสมอ (UAT มีคนอื่นใช้ร่วม)
//
//   ขั้น 1 ตรวจว่ายิงได้ (smoke, ~35 วินาที):
//     k6 run -e BASE_URL=http://10.22.51.190/drrs-api -e VUS=5 -e DURATION=30s uat-readonly.js
//
//   ขั้น 2 โหลดปกติ (ใต้เพดาน rate limiter):
//     k6 run -e BASE_URL=http://10.22.51.190/drrs-api -e VUS=10 -e DURATION=2m uat-readonly.js
//
//   ขั้น 3 ไต่หาจุดตัน (ต้องให้ทีม UAT เพิ่ม RATE_LIMIT_MAX ก่อน):
//     k6 run -e BASE_URL=http://10.22.51.190/drrs-api -e STAGES='[{"duration":"1m","target":20},{"duration":"1m","target":50},{"duration":"1m","target":100},{"duration":"30s","target":0}]' uat-readonly.js
//
// ------------------------------------------------------------
// ข้อควรรู้เรื่อง rate limiter
//   UAT ตั้ง RATE_LIMIT_MAX=1000 ต่อ 60 วินาที ต่อ 1 IP
//   1 รอบผู้ใช้ = 2 request ดังนั้นเพดานคือ ~500 รอบ/นาที
//   ถ้ายิงเกินจะได้ 429 ซึ่ง "ไม่ใช่" ความช้าของระบบ แต่เป็นตัวจำกัดเอง
//   script นี้แยกนับ 429 ออกมาเป็น metric rate_limited ให้เห็นชัดว่าชนเพดานเมื่อไร
//
// ค่าที่ปรับได้ผ่าน -e:
//   BASE_URL  ที่อยู่ API (จำเป็น)
//   VUS       จำนวนผู้ใช้พร้อมกัน (default 10)
//   DURATION  ระยะเวลาค้างโหลด (default 1m)
//   RAMP      เวลาไต่ขึ้น/ลง (default 15s)
//   SLEEP     พักต่อ 1 รอบผู้ใช้ วินาที (default 1)
//   P95       เกณฑ์ p95 มิลลิวินาที (default 800)
//   ERR_RATE  เกณฑ์อัตราล้มเหลว (default 0.01 = 1%)
//   STAGES    กำหนด stages เองเป็น JSON (ถ้าตั้ง จะทับ VUS/DURATION/RAMP)
// ============================================================

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const failRate = new Rate("failed_requests");
const rateLimited = new Rate("rate_limited"); // แยกเคส 429 ออกจาก error จริง

const closeSystemDuration = new Trend("dur_check_close_system", true);
const encryptionDuration = new Trend("dur_encryption", true);

const BASE_URL = __ENV.BASE_URL;
const SLEEP = Number(__ENV.SLEEP || 1);
const P95 = Number(__ENV.P95 || 800);
const ERR_RATE = Number(__ENV.ERR_RATE || 0.01);

if (!BASE_URL) {
  throw new Error("ต้องระบุ BASE_URL เช่น -e BASE_URL=http://10.22.51.190/drrs-api");
}

function buildStages() {
  if (__ENV.STAGES) return JSON.parse(__ENV.STAGES);
  const vus = Number(__ENV.VUS || 10);
  const duration = __ENV.DURATION || "1m";
  const ramp = __ENV.RAMP || "15s";
  return [
    { duration: ramp, target: vus },
    { duration: duration, target: vus },
    { duration: ramp, target: 0 },
  ];
}

export const options = {
  stages: buildStages(),
  thresholds: {
    http_req_duration: [`p(95)<${P95}`],
    failed_requests: [`rate<${ERR_RATE}`],
  },
  // ไม่ให้ k6 นับ 429 เป็น error ของระบบ (เราแยกนับเองใน rate_limited)
  discardResponseBodies: false,
};

const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

/** ตรวจผลลัพธ์ 1 request แล้วบันทึก metric ให้ครบ */
function evaluate(res, name, extraChecks = {}) {
  const is429 = res.status === 429;
  rateLimited.add(is429);

  // 429 = ชนเพดาน rate limiter ไม่ใช่ระบบพัง จึงไม่นับเป็น failed
  const ok = check(res, {
    [`${name}: status 200`]: (r) => r.status === 200 || r.status === 429,
    ...extraChecks,
  });
  failRate.add(!ok);
  return ok;
}

export default function () {
  group("checkCloseSystem", function () {
    const res = http.post(
      `${BASE_URL}/api/checkCloseSystem`,
      JSON.stringify({ channel: "DRRS" }),
      JSON_HEADERS
    );
    closeSystemDuration.add(res.timings.duration);
    evaluate(res, "checkCloseSystem", {
      "checkCloseSystem: บอกสถานะระบบได้": (r) => {
        if (r.status !== 200) return true; // ข้ามเคส 429
        try {
          return typeof JSON.parse(r.body).data[0].status_flag === "boolean";
        } catch (e) {
          return false;
        }
      },
    });
  });

  group("encryption", function () {
    const res = http.post(
      `${BASE_URL}/utils/encryption`,
      JSON.stringify({ value: `loadtest-${__VU}-${__ITER}` }),
      JSON_HEADERS
    );
    encryptionDuration.add(res.timings.duration);
    evaluate(res, "encryption", {
      "encryption: ได้ค่าที่เข้ารหัสกลับมา": (r) => {
        if (r.status !== 200) return true; // ข้ามเคส 429
        try {
          const body = JSON.parse(r.body);
          return typeof body.encrypted === "string" && body.encrypted.length > 0;
        } catch (e) {
          return false;
        }
      },
    });
  });

  sleep(SLEEP);
}

export function handleSummary(data) {
  const m = data.metrics;
  const get = (name, key) => {
    const v = m[name] && m[name].values;
    return v ? v[key] : undefined;
  };
  const ms = (n) => (n === undefined ? "-" : `${n.toFixed(0)} ms`);
  const pct = (n) => (n === undefined ? "-" : `${(n * 100).toFixed(2)}%`);

  const lines = [
    "",
    "==================== สรุปผล UAT (read-only) ====================",
    `จำนวน request ทั้งหมด : ${get("http_reqs", "count") ?? "-"}`,
    `อัตราล้มเหลวจริง      : ${pct(get("failed_requests", "rate"))}`,
    `ชนเพดาน rate limit    : ${pct(get("rate_limited", "rate"))}  <- ถ้าสูง ให้เพิ่ม RATE_LIMIT_MAX แล้วยิงใหม่`,
    "",
    "เวลาตอบสนองรวมทุกเส้น",
    `  p50 : ${ms(get("http_req_duration", "med"))}`,
    `  p95 : ${ms(get("http_req_duration", "p(95)"))}`,
    `  max : ${ms(get("http_req_duration", "max"))}`,
    "",
    "แยกตามเส้น (p95)",
    `  checkCloseSystem (อ่าน DB) : ${ms(get("dur_check_close_system", "p(95)"))}`,
    `  encryption (กิน CPU)       : ${ms(get("dur_encryption", "p(95)"))}`,
    "================================================================",
    "",
  ];

  return {
    stdout: lines.join("\n"),
    "uat-readonly-summary.json": JSON.stringify(data, null, 2),
  };
}
