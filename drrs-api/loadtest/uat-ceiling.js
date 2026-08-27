// ============================================================
// k6 Ceiling Test — หาเพดาน throughput จริงของ DRRS API
//
// ต่างจาก uat-readonly.js อย่างไร
//   uat-readonly.js  = ตั้งจำนวน "คน" (VUs) แล้วดูว่าตอบเร็วแค่ไหน
//                      คุมความแรงด้วย think time เลยไม่เคยรู้เพดาน
//   uat-ceiling.js   = ตั้งจำนวน "request ต่อวินาที" ตรงๆ แล้วไล่ขึ้นเป็นขั้น
//                      จนระบบเริ่มพัง เพื่อตอบว่า "รับได้กี่ tps"
//
// ยิงเส้นเดียว: POST /api/checkCloseSystem
//   เลือกเส้นนี้เพราะเป็นเส้นที่แตะ DB และเป็นตัวที่แย่ลงชัดสุดในการวัดรอบก่อน
//   (5 คน -> 100 คน p95 แย่ลง 6.8 เท่า ขณะที่เส้นที่ใช้แต่ CPU แย่ลงแค่ 2 เท่า)
//   1 iteration = 1 request ดังนั้นเลข rate = req/s ตรงๆ ไม่ต้องคูณอะไร
//
// ตรวจแล้วว่าเส้นนี้ไม่เขียน DB:
//   utilRoutes.js ไม่ได้ใส่ systemLogMiddleware ให้ /checkCloseSystem
//   จึงไม่มีการ INSERT ลง tbl_system_log ระหว่างทดสอบ
//
// ------------------------------------------------------------
// เบรกฉุกเฉิน (สำคัญ)
//   ตั้ง threshold แบบ abortOnFail ไว้ 2 ตัว ถ้าแตะเงื่อนไข k6 จะ
//   หยุดทั้งการทดสอบทันที ไม่ไล่ขั้นต่อ เพื่อไม่ให้ UAT ล่ม
//     - อัตราล้มเหลวเกิน 2%
//     - p95 เกิน 1500 ms
//
// ------------------------------------------------------------
// วิธีรัน
//   k6 run -e BASE_URL=http://10.22.51.190/drrs-api uat-ceiling.js
//
// ค่าที่ปรับได้ผ่าน -e
//   BASE_URL   ที่อยู่ API (จำเป็น)
//   STEP_DUR   ระยะเวลาแต่ละขั้น (default 30s)
//   RATES      รายการ req/s คั่นด้วย comma (default 20,50,100,200,400)
//   MAX_P95    เกณฑ์เบรก p95 มิลลิวินาที (default 1500)
//   MAX_FAIL   เกณฑ์เบรกอัตราล้มเหลว (default 0.02 = 2%)
// ============================================================

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) {
  throw new Error("ต้องระบุ BASE_URL เช่น -e BASE_URL=http://10.22.51.190/drrs-api");
}

const STEP_DUR = __ENV.STEP_DUR || "30s";
const MAX_P95 = Number(__ENV.MAX_P95 || 1500);
const MAX_FAIL = Number(__ENV.MAX_FAIL || 0.02);

const RATES = (__ENV.RATES || "20,50,100,200,400")
  .split(",")
  .map((r) => parseInt(r.trim(), 10))
  .filter((r) => r > 0);

// ให้แต่ละขั้นเริ่มห่างกัน = ระยะเวลาขั้น + 5 วินาที (เว้นให้ระบบหายใจ)
const stepSeconds = parseInt(STEP_DUR, 10) || 30;
const GAP = 5;

/** ชื่อ tag ของขั้น เช่น 20 -> r0020 (เติมศูนย์ให้เรียงถูก) */
function stepTag(rate) {
  return `r${String(rate).padStart(4, "0")}`;
}

const scenarios = {};
const perStepThresholds = {};

RATES.forEach((rate, i) => {
  const tag = stepTag(rate);
  scenarios[tag] = {
    executor: "constant-arrival-rate",
    rate: rate,
    timeUnit: "1s",
    duration: STEP_DUR,
    startTime: `${i * (stepSeconds + GAP)}s`,
    // เผื่อ VU ให้พอ ถ้าระบบช้าลง k6 ต้องใช้ VU มากขึ้นเพื่อคง rate เดิม
    preAllocatedVUs: Math.max(10, Math.ceil(rate * 0.4)),
    maxVUs: Math.max(50, rate * 3),
    gracefulStop: "5s",
    tags: { step: tag },
    exec: "hitCheckCloseSystem",
  };

  // threshold ที่ผ่านตลอด — ใส่ไว้เพื่อให้ k6 สร้าง sub-metric แยกตามขั้น
  // ถ้าไม่ประกาศไว้ จะอ่านตัวเลขแยกขั้นใน handleSummary ไม่ได้
  perStepThresholds[`http_req_duration{step:${tag}}`] = ["p(95)<99999999"];
  perStepThresholds[`http_req_failed{step:${tag}}`] = ["rate<2"];
  perStepThresholds[`http_reqs{step:${tag}}`] = ["count>=0"];
});

export const options = {
  scenarios: scenarios,
  thresholds: Object.assign(
    {
      // ---- เบรกฉุกเฉิน ----
      // delayAbortEval ให้เวลา warm up ก่อน ไม่ตัดสินจาก request แรกๆ
      http_req_failed: [
        { threshold: `rate<${MAX_FAIL}`, abortOnFail: true, delayAbortEval: "10s" },
      ],
      http_req_duration: [
        { threshold: `p(95)<${MAX_P95}`, abortOnFail: true, delayAbortEval: "10s" },
      ],
    },
    perStepThresholds
  ),
};

const PAYLOAD = JSON.stringify({ channel: "DRRS" });
const PARAMS = { headers: { "Content-Type": "application/json" } };

export function hitCheckCloseSystem() {
  const res = http.post(`${BASE_URL}/api/checkCloseSystem`, PAYLOAD, PARAMS);
  check(res, {
    "status 200": (r) => r.status === 200,
    "ตอบสถานะระบบมาถูกต้อง": (r) => {
      if (r.status !== 200) return false;
      try {
        return typeof JSON.parse(r.body).data[0].status_flag === "boolean";
      } catch (e) {
        return false;
      }
    },
  });
}

export function handleSummary(data) {
  const m = data.metrics;
  const val = (name, key) => {
    const metric = m[name];
    return metric && metric.values ? metric.values[key] : undefined;
  };
  const ms = (n) => (n === undefined ? "-" : `${n.toFixed(0)}`);
  const pct = (n) => (n === undefined ? "-" : `${(n * 100).toFixed(2)}%`);
  const pad = (s, w) => String(s).padStart(w);

  const lines = [
    "",
    "================== เพดาน throughput ของ DRRS API ==================",
    "ยิง POST /api/checkCloseSystem (เส้นที่อ่าน DB) 1 request ต่อ 1 iteration",
    "",
    "  ตั้งไว้   ยิงได้   ล้มเหลว      p50     p95     p99     ช้าสุด",
    "  (req/s)  (req)                (ms)    (ms)    (ms)     (ms)",
    "  " + "-".repeat(62),
  ];

  for (const rate of RATES) {
    const tag = stepTag(rate);
    const count = val(`http_reqs{step:${tag}}`, "count");
    if (count === undefined || count === 0) {
      lines.push(`  ${pad(rate, 6)}   ${pad("ไม่ได้ยิง (หยุดก่อนถึงขั้นนี้)", 10)}`);
      continue;
    }
    lines.push(
      "  " +
        pad(rate, 6) +
        "  " +
        pad(count, 7) +
        "  " +
        pad(pct(val(`http_req_failed{step:${tag}}`, "rate")), 8) +
        "  " +
        pad(ms(val(`http_req_duration{step:${tag}}`, "med")), 7) +
        " " +
        pad(ms(val(`http_req_duration{step:${tag}}`, "p(95)")), 7) +
        " " +
        pad(ms(val(`http_req_duration{step:${tag}}`, "p(99)")), 7) +
        " " +
        pad(ms(val(`http_req_duration{step:${tag}}`, "max")), 8)
    );
  }

  const dropped = val("dropped_iterations", "count") || 0;
  lines.push("  " + "-".repeat(62));
  lines.push("");
  lines.push(`รวมทุกขั้น : ${val("http_reqs", "count") ?? "-"} request`);
  lines.push(`ล้มเหลวรวม : ${pct(val("http_req_failed", "rate"))}`);
  lines.push(`throughput สูงสุดที่วัดได้ : ${(val("http_reqs", "rate") ?? 0).toFixed(1)} req/s (เฉลี่ยทั้งการทดสอบ)`);
  lines.push("");

  if (dropped > 0) {
    lines.push(`!! dropped_iterations = ${dropped}`);
    lines.push(`   k6 ยิงไม่ทันตามที่ตั้งไว้ แปลว่าตัวเลขขั้นท้ายๆ อาจติดขัดที่`);
    lines.push(`   เครื่องที่รัน k6 หรือเน็ต ไม่ใช่ที่ server เสมอไป ต้องดูประกอบ`);
  } else {
    lines.push("dropped_iterations = 0 -> k6 ยิงได้ครบตามที่ตั้งไว้ทุกขั้น");
    lines.push("ตัวเลขข้างบนสะท้อนฝั่ง server ได้ตรง");
  }
  lines.push("");
  lines.push("วิธีอ่าน: มองหาขั้นแรกที่ p95 กระโดด หรือเริ่มมี % ล้มเหลว");
  lines.push("นั่นคือจุดที่ระบบเริ่มรับไม่อยู่");
  lines.push("=".repeat(66));
  lines.push("");

  return {
    stdout: lines.join("\n"),
    "uat-ceiling-summary.json": JSON.stringify(data, null, 2),
  };
}
