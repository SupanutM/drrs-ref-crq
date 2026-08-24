// ============================================================
// k6 Load Test — Read-only endpoints (ปลอดภัยสำหรับเริ่มต้น)
// ยิง 2 เส้น: POST /utils/checkCloseSystem และ GET /api/master/provinces
// ทั้งสองเส้นเป็นการอ่านข้อมูล ไม่เขียน DB และไม่แตะ DOPA API
//
// วิธีรัน (ปรับค่าได้ผ่าน -e ไม่ต้องแก้โค้ด):
//   k6 run -e BASE_URL=http://localhost:5000 read-endpoints.js
//
// ยิง UAT แบบเบาๆ ก่อน (ใต้เพดาน rate limiter):
//   k6 run -e BASE_URL=http://10.22.51.190/drrs-api -e VUS=8 -e DURATION=1m read-endpoints.js
//
// ยิงเต็ม (ต้องให้ทีม UAT เพิ่ม/ปิด RATE_LIMIT ก่อน):
//   k6 run -e BASE_URL=http://10.22.51.190/drrs-api -e VUS=50 -e DURATION=3m read-endpoints.js
//
// ค่า -e ที่ปรับได้:
//   BASE_URL   ที่อยู่ server ที่จะเทส (จำเป็น)
//   VUS        จำนวนผู้ใช้พร้อมกัน (default 50) — ใช้เมื่อไม่ตั้ง STAGES
//   DURATION   ระยะเวลาค้างโหลด (default 2m)   — ใช้เมื่อไม่ตั้ง STAGES
//   RAMP       เวลาไต่ขึ้น/ลง (default 30s)     — ใช้เมื่อไม่ตั้ง STAGES
//   SLEEP      เวลาพักต่อ 1 รอบผู้ใช้ วินาที (default 1)
//   P95        เกณฑ์ p95 latency มิลลิวินาที (default 800)
//   ERR_RATE   เกณฑ์อัตราล้มเหลวสูงสุด (default 0.01 = 1%)
//   STAGES     กำหนด stages เองเป็น JSON (ถ้าตั้ง จะทับ VUS/DURATION/RAMP)
//              ตัวอย่าง: -e STAGES='[{"duration":"30s","target":10},{"duration":"1m","target":10}]'
// ============================================================

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";

const failRate = new Rate("failed_requests");

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const SLEEP = Number(__ENV.SLEEP || 1);
const P95 = Number(__ENV.P95 || 800);
const ERR_RATE = Number(__ENV.ERR_RATE || 0.01);

// สร้าง stages: ถ้าตั้ง STAGES เป็น JSON มา ใช้ตามนั้น
// ไม่งั้นสร้างจาก VUS / DURATION / RAMP (ไต่ขึ้น -> ค้าง -> ไต่ลง)
function buildStages() {
  if (__ENV.STAGES) {
    return JSON.parse(__ENV.STAGES);
  }
  const vus = Number(__ENV.VUS || 50);
  const duration = __ENV.DURATION || "2m";
  const ramp = __ENV.RAMP || "30s";
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
    http_req_failed: [`rate<${ERR_RATE}`],
  },
};

export default function () {
  group("checkCloseSystem", function () {
    const res = http.post(
      `${BASE_URL}/utils/checkCloseSystem`,
      JSON.stringify({ channel: "DRRS" }),
      { headers: { "Content-Type": "application/json" } }
    );
    const ok = check(res, {
      "checkCloseSystem status 200": (r) => r.status === 200,
    });
    failRate.add(!ok);
  });

  group("getProvinces", function () {
    const res = http.get(`${BASE_URL}/api/master/provinces`);
    const ok = check(res, {
      "provinces status 200": (r) => r.status === 200,
      "provinces has data": (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).data);
        } catch (e) {
          return false;
        }
      },
    });
    failRate.add(!ok);
  });

  sleep(SLEEP);
}
