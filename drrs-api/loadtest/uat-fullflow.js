// ============================================================
// k6 Full-Flow Ceiling Test — ยิงครบ flow จริงของ DRRS
//   verify-register  (ถอดรหัส + อ่าน DB 2 บัญชี + ดึงแผน + เขียน DB)
//        -> generate-contract (สร้าง PDF pdfkit + set stepSendToCbs)
//
// ทำไมต้อง pre-generate payload:
//   verify ต้องส่ง name/surname ที่เข้ารหัส AES-GCM ด้วย CRYPTO_KEY
//   k6 ทำ GCM เองไม่ได้ จึงให้ Node สร้าง flow-payloads.json ไว้ก่อน (gen-flow-payloads.js)
//
// ข้อจำกัดสำคัญ — 1 ราย ยิงได้ครั้งเดียว:
//   generate-contract จะ set stepSendToCbs=1 ทำให้ลูกค้าคนนั้นถูก "ลงทะเบียนครบ"
//   ยิง verify ซ้ำคนเดิมจะโดน 403 ดังนั้นทุก iteration ต้องใช้คนใหม่ (unique)
//   ใช้ตัวนับ global (__ITER รวมทุก VU ไม่ได้ตรงๆ ใน k6) => ใช้ exec.scenario.iterationInTest
//
// เบรกฉุกเฉิน: p95 เกิน MAX_P95 หรือ fail เกิน MAX_FAIL -> หยุดทั้งเทสต์
//
// รัน:
//   k6 run -e BASE_URL=http://10.22.51.190/drrs-api uat-fullflow.js
// ปรับได้: RATES, STEP_DUR, MAX_P95, MAX_FAIL
// ============================================================

import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error("ต้องระบุ BASE_URL");

const STEP_DUR = __ENV.STEP_DUR || "30s";
const MAX_P95 = Number(__ENV.MAX_P95 || 3000);   // full flow หนักกว่า read เดี่ยว ตั้งเพดานสูงขึ้น
const MAX_FAIL = Number(__ENV.MAX_FAIL || 0.02);

const RATES = (__ENV.RATES || "20,50,100,200,300")
  .split(",").map((r) => parseInt(r.trim(), 10)).filter((r) => r > 0);

// โหลด payload ที่เข้ารหัสไว้แล้ว (อ่านครั้งเดียว แชร์ทุก VU)
const payloads = new SharedArray("verify-payloads", () =>
  JSON.parse(open("./flow-payloads.json"))
);

// metric แยกต่อ step
const verifyDur = new Trend("step_verify_ms", true);
const contractDur = new Trend("step_contract_ms", true);
const verifyFail = new Rate("step_verify_failed");
const contractFail = new Rate("step_contract_failed");

const stepSeconds = parseInt(STEP_DUR, 10) || 30;
const GAP = 5;
const stepTag = (rate) => `r${String(rate).padStart(4, "0")}`;

const scenarios = {};
const perStepThresholds = {};
const scenarioOffsets = {};   // แต่ละ scenario จะเริ่มดึง payload จาก index ที่ไม่ซ้ำกัน
let cumulativeOffset = 0;
RATES.forEach((rate, i) => {
  const tag = stepTag(rate);
  scenarioOffsets[tag] = cumulativeOffset;
  cumulativeOffset += rate * stepSeconds;   // จอง slot = rate × duration
  scenarios[tag] = {
    executor: "constant-arrival-rate",
    rate: rate,
    timeUnit: "1s",
    duration: STEP_DUR,
    startTime: `${i * (stepSeconds + GAP)}s`,
    preAllocatedVUs: Math.max(20, rate),
    maxVUs: Math.max(100, rate * 5),
    gracefulStop: "5s",
    tags: { step: tag },
    exec: "runFlow",
  };
  perStepThresholds[`http_req_duration{step:${tag}}`] = ["p(95)<99999999"];
});

export const options = {
  scenarios,
  thresholds: Object.assign(
    {
      http_req_failed: [{ threshold: `rate<${MAX_FAIL}`, abortOnFail: true, delayAbortEval: "15s" }],
      http_req_duration: [{ threshold: `p(95)<${MAX_P95}`, abortOnFail: true, delayAbortEval: "15s" }],
    },
    perStepThresholds
  ),
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export function runFlow() {
  // เลือก payload แบบไม่ซ้ำทั่วทั้งเทสต์ (unique customer ต่อ 1 iteration)
  // ใช้ offset ของ scenario + iterationInTest เพื่อไม่ให้ซ้ำข้าม scenario
  const offset = scenarioOffsets[exec.scenario.name] || 0;
  const idx = (offset + exec.scenario.iterationInTest) % payloads.length;
  const p = payloads[idx];

  // ---- STEP 1: verify-register ----
  const vBody = JSON.stringify({
    verifyCode: p.verifyCode, citizenId: p.citizenId, name: p.name, surname: p.surname,
    dateOfBirth: p.dateOfBirth, laserCardId: p.laserCardId, email: p.email, telNo: p.telNo,
  });
  const v = http.post(`${BASE_URL}/api/verify-register`, vBody, {
    headers: JSON_HEADERS, tags: { name: "verify" },
  });
  verifyDur.add(v.timings.duration);
  let token = null, accountNo = null;
  const vok = check(v, { "verify 200": (r) => r.status === 200 });
  verifyFail.add(!vok);
  if (!vok) return;
  try {
    const j = v.json();
    token = j.data.token;
    accountNo = j.data.targetInfo.accounts[0].accountNo;
  } catch (e) {
    verifyFail.add(true);
    return;
  }
  if (!token || !accountNo) return;

  // ---- STEP 2: generate-contract ----
  const gBody = JSON.stringify({
    selectedAccounts: [
      {
        accountNo, planNo: "02", isHaircut: false,
        paymentAmount: 3000, installmentTerms: 24,
        loanAmount: 100000, outstandingBalance: 80000, principal: 70000, interest: 10000,
      },
    ],
  });
  const g = http.post(`${BASE_URL}/api/generate-contract`, gBody, {
    headers: Object.assign({ Authorization: `Bearer ${token}` }, JSON_HEADERS),
    tags: { name: "contract" },
  });
  contractDur.add(g.timings.duration);
  const gok = check(g, {
    "contract 200": (r) => r.status === 200,
    "มี pdf base64": (r) => {
      try { const j = r.json(); return !!(j.base64Download || j.base64); } catch (e) { return false; }
    },
  });
  contractFail.add(!gok);
}

export function handleSummary(data) {
  const m = data.metrics;
  const val = (n, k) => (m[n] && m[n].values ? m[n].values[k] : undefined);
  const ms = (n) => (n === undefined ? "-" : n.toFixed(0));
  const pct = (n) => (n === undefined ? "-" : (n * 100).toFixed(2) + "%");
  const pad = (s, w) => String(s).padStart(w);

  const lines = [
    "",
    "============= Full-Flow (verify -> generate-contract) บน DRRS UAT =============",
    "1 iteration = verify-register + generate-contract (สร้าง PDF จริง) ต่อลูกค้า 1 ราย",
    "",
    "  ขั้น req/s  verify(iter)  verify p95   contract p95   fail รวม",
    "  " + "-".repeat(64),
  ];
  RATES.forEach((rate) => {
    const tag = stepTag(rate);
    const cnt = val(`http_reqs{step:${tag}}`, "count");
    if (!cnt) { lines.push(`  ${pad(rate, 6)}   (ไม่ได้ยิง / หยุดก่อน)`); return; }
    lines.push(
      "  " + pad(rate, 6) + "   " +
      pad(val(`http_reqs{step:${tag}}`, "count"), 10) + "  " +
      pad(ms(val(`http_req_duration{step:${tag}}`, "p(95)")), 9) + "ms  " +
      pad(ms(val(`http_req_duration{step:${tag}}`, "p(99)")), 9) + "ms  " +
      pad(pct(val(`http_req_failed{step:${tag}}`, "rate")), 8)
    );
  });
  lines.push("  " + "-".repeat(64));
  lines.push("");
  lines.push(`verify   : p50 ${ms(val("step_verify_ms", "med"))}ms  p95 ${ms(val("step_verify_ms", "p(95)"))}ms  fail ${pct(val("step_verify_failed", "rate"))}`);
  lines.push(`contract : p50 ${ms(val("step_contract_ms", "med"))}ms  p95 ${ms(val("step_contract_ms", "p(95)"))}ms  fail ${pct(val("step_contract_failed", "rate"))}`);
  lines.push(`รวม request : ${val("http_reqs", "count")}  |  http_req_failed รวม ${pct(val("http_req_failed", "rate"))}`);
  lines.push(`throughput เฉลี่ย : ${(val("http_reqs", "rate") || 0).toFixed(1)} req/s (นับ 2 request/flow)`);
  const dropped = val("dropped_iterations", "count") || 0;
  lines.push(dropped > 0 ? `!! dropped_iterations = ${dropped} (k6 ยิงไม่ทัน — ดูเครื่อง k6 ประกอบ)` : "dropped_iterations = 0");
  lines.push("=".repeat(78));
  lines.push("");

  return { stdout: lines.join("\n"), "uat-fullflow-summary.json": JSON.stringify(data, null, 2) };
}
