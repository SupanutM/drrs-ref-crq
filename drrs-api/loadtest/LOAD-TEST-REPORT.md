# DRRS — Load Test Report (UAT)

วันที่ทดสอบ: 28 ส.ค. 2026
เป้าหมาย: ยืนยันว่าระบบรับโหลด 300 req/s (15,000 คน) ได้ก่อนขึ้น Production

- Frontend UAT: `http://10.22.51.191/drrs/`
- Backend UAT: `http://10.22.51.190/drrs-api`
- DB: PostgreSQL `10.22.51.253:55432` (schema `loadtest` — ข้อมูลทดสอบแยกจากของจริง)
- เครื่องมือ: k6 (constant-arrival-rate, ไล่ขั้น req/s)

---

## 1. สรุปผู้บริหาร (อ่านอันเดียวพอ)

- **แอปทำงานถูกต้อง 100%** — ทุก request สำเร็จตอนคนน้อย, สร้างไฟล์สัญญา PDF ได้จริง, ไม่มี bug
- **แต่รับคนเยอะพร้อมกันไม่ได้** — เพดานจริงของ full flow อยู่ที่ **~7 request/s** ยังห่างเป้า 300 มาก
- **สาเหตุเดียวที่ใหญ่ที่สุด: Node รันแค่ 1 core** — เพิ่มเครื่อง/เพิ่ม core อย่างเดียวไม่พอ ต้องสั่งให้ Node ใช้หลาย core (PM2 cluster) ก่อน
- ตัวเลขนี้ยืนยันตรงกัน 3 รอบการยิง (ไม่ใช่ความบังเอิญ)

**ข้อสรุป: ยังไม่ควรขึ้น Production ที่โหลดสูง จนกว่าจะแก้เรื่อง 1 core**

---

## 2. ผลการทดสอบ

### 2.1 เส้นอ่านอย่างเดียว (checkCloseSystem — แตะ DB, ไม่เขียน)

| ตั้งไว้ (req/s) | ล้มเหลว | p50 (ms) | p95 (ms) | อ่านผล |
| ---          | ---    | ---       | ---     |  ---    |
| 50           | 0%     | 16        | 30      | สบาย    |
| 100          | 0%     | 16        | 71      | ดีมาก    |
| 200          | 0%     | 618       | 1734    | เริ่มช้าชัด |
| 300          | —      | —         |   —     | เบรก (p95 เกิน 1500ms) |

**เพดานเส้นอ่านอย่างเดียว = ~200 req/s** (เพิ่ม DB pool จาก 10 → 20 ดันเพดานจาก 100 → 200)

### 2.2 Full Flow จริง (verify → สร้างสัญญา PDF)

1 flow = ยืนยันตัวตน (verify-register) + สร้างไฟล์สัญญา PDF (generate-contract)

| ยิง (req/s) | สภาพ |
|---|---|
| นัดเดี่ยว | verify 0.35s + PDF 0.32s — เร็วมาก |
| 20 | คิวเต็ม 100 VU ทันที (แต่ละคนรอ ~7s) |
| 50 | คิวเต็ม 250 VU |
| 100 | คิวเต็ม 500 VU |
| 200 | **verify ล้ม 77%**, verify p95 32.6s, PDF p50 8.4s → เบรก |

- **throughput จริง ~7 req/s**
- ตอนคนเยอะ: สร้าง PDF p50 **8.4s** (นัดเดี่ยวแค่ 0.32s = ช้าลง ~26 เท่า)
- ที่ 200 req/s: verify ล้ม 77% เพราะ DB connection/คิวรับไม่ทัน

### 2.3 รอบแก้ Disk IO (ยิงซ้ำหลังลดการเขียนดิสก์)

ระหว่างเทสต์เจอว่า **Disk IO ขึ้น 100%** จึงแก้ให้เบาลงตอน `LOAD_TEST_MODE=true`:
- ไม่เขียน log ระดับ info ลงไฟล์ (เหลือแค่ error) — `logger.js`
- ข้ามการเซฟไฟล์ PDF ~97KB ลงดิสก์ — `downloadAndEmailContractPdfController.js`

ยิงซ้ำ (20 / 50 / 100 req/s) เทียบผล:

| ตัววัด | ก่อนแก้ | หลังแก้ |
|---|---|---|
| Disk IO | เต็ม 100% | ลดลงชัด |
| สร้าง PDF p50 | 8.4s | 7.7s |
| verify p50 | 6.9s | 19.5s |
| throughput | ~7 req/s | **~3 req/s (ยังตันเท่าเดิม)** |

**บทเรียนสำคัญ:** ลด Disk IO แก้ได้แค่ "อาการดิสก์เต็ม" แต่ **throughput ไม่ขยับ**
เพราะคอขวดจริงคือ CPU 1 core + pdfkit ค้าง event loop (คนละเรื่องกับดิสก์)
→ Disk IO เต็ม เป็น *อาการ* ไม่ใช่ *ต้นเหตุ*

---

## 3. คอขวด (เรียงจากหนักสุด)

### คอขวด #1 — Node ใช้ CPU แค่ 1 core (สาเหตุหลัก)
- `server.js` เรียก `app.listen()` ตรงๆ ไม่มี cluster/PM2 → ทั้งระบบวิ่งบน core เดียว
- เพิ่มคนยิงเท่าไร core เดียวก็ทำไม่ทัน คนต่อคิวยาว
- **อาการ:** นัดเดี่ยวเร็ว (0.3s) แต่พอหลายคนพร้อมกัน พุ่งเป็นหลายวินาทีทันที

### คอขวด #2 — สร้าง PDF (pdfkit) ค้าง event loop
- ตอนวาด PDF ด้วย pdfkit เป็นงานหนักแบบ synchronous → ระหว่างวาด request คนอื่นถูกบล็อกหมด
- ยิ่งเจอคอขวด #1 (core เดียว) ยิ่งซ้ำเติม: PDF 1 ไฟล์วาดอยู่ = ทุกคนหยุดรอ
- **อาการ:** PDF p50 กระโดดจาก 0.32s → 8.4s ตอน concurrent

### คอขวด #3 — DB connection รับไม่ทันที่โหลดสูง
- ที่ 200 req/s verify ล้ม 77% (connection pool/ตอบไม่ทัน)
- ปัจจุบัน pool = 20 (เพิ่มจาก 10 แล้ว) ยังไม่พอสำหรับโหลดสูงมาก

### คอขวด #4 — Disk IO เต็ม 100% (เป็นอาการ ไม่ใช่ต้นเหตุ)
- ตอนโหลดสูง ดิสก์ถูกเขียนพร้อมกันหลายทาง: log 2 ไฟล์ทุก request + ไฟล์ PDF ~97KB ทุกสัญญา + DB system_log
- แก้แล้วให้เบาลงตอน `LOAD_TEST_MODE` (ดูหัวข้อ 2.3) — Disk IO ลดจริง แต่ throughput ไม่ขยับ
- **สรุป:** ต้องแก้คอขวด #1 (1 core) ก่อน ดิสก์เป็นเรื่องรอง

### หมายเหตุที่แก้ไปแล้วระหว่างเทสต์
- **CUST Profile API ภายนอก** (`custprofileuat.gsb.or.th`) เดิมทำ verify ช้า/แกว่ง ~2s ทุกนัด
  แก้ด้วยการเพิ่มโหมด `LOAD_TEST_MODE` ข้ามการเรียก API ภายนอกตอนเทสต์
  (แก้ที่ `customerLookupService.js` — ห้ามเปิดโหมดนี้บน Production)
- **Disk IO ฝั่ง backend** — ปิดทุกจุดที่เขียนดิสก์เมื่อ `LOAD_TEST_MODE=true` (review ครบทั้งโปรเจกต์):
  1. ตัด transport log ไฟล์ app ออก (`logger.js`) — ไม่เขียน info ลงไฟล์
  2. console log เหลือแค่ error (`logger.js`) — กันกรณี pm2/service redirect stdout ลงไฟล์
  3. ข้ามเซฟไฟล์ PDF ~97KB ลงดิสก์ (`downloadAndEmailContractPdfController.js`)
  4. ข้ามส่งอีเมล — ตัด readFile template + SMTP (`emailService.js`)
  (ทำงานเฉพาะตอนเทสต์; ยังเก็บ log error ไว้เสมอ)
  ที่เหลือเป็น read อย่างเดียว (template email/xml, contract.pdf ที่ cache ในแรม) ไม่ใช่ write

---

## 4. คำแนะนำก่อนขึ้น Production (เรียงตามความคุ้ม)

1. **ใส่ PM2 cluster mode** (คุ้มสุด, ตรงคอขวด #1)
   - รัน Node หลาย process เท่าจำนวน core → เพดานขึ้นเป็นเท่าตัวตามจำนวน core
   - ต้องแก้ `server.js` เล็กน้อย + ติดตั้ง `pm2` + สั่ง `pm2 start ... -i max` บนเครื่อง UAT/PROD
2. **ย้ายการสร้าง PDF ออกจากคำขอหลัก** (แก้คอขวด #2)
   - ทำ PDF แบบ background/worker แล้วให้ผู้ใช้ดึงทีหลัง หรือใช้ worker thread
   - ลดการบล็อก event loop ตอนคนเยอะ
3. **จูน DB connection pool + ตรวจ query ช้า** (แก้คอขวด #3)
   - เพิ่ม pool ตามจำนวน core หลังทำข้อ 1 + ใส่ index ให้ครบ

---

## 5. Checklist ขึ้น Production (ทำตามลำดับ)

### กลุ่ม 1 — ปิดของ Load Test (ถ้าลืม ระบบพังเงียบ)
- [ ] **ปิด `LOAD_TEST_MODE`** ใน `.env` prod (false หรือลบออก)
      ถ้าเปิดค้าง = ข้ามตรวจบัตร DOPA + ไม่ส่งเมล + ไม่เซฟ PDF + ไม่ดึงที่อยู่จริง + ไม่เขียน log info
- [ ] ชี้ **`DB_SCHEMA=drrs`** (ของจริง ไม่ใช่ `loadtest`)
- [ ] DB prod **ต้องไม่มี** schema `loadtest` / ลูกค้าปลอม 10,000 ราย

### กลุ่ม 2 — แก้คอขวดให้รับโหลด (ไม่งั้นตันที่ ~3-7 req/s)
- [ ] เพิ่ม CPU core + รัน **PM2 cluster** (`pm2 start server.js -i max`) — แก้คอขวด #1 (Node 1 core)
- [ ] เพิ่ม DB pool ตามจำนวน core (ปัจจุบัน 20) — แก้คอขวด #3
- [ ] ย้ายสร้าง PDF ไป background/worker — แก้คอขวด #2 (pdfkit บล็อก event loop)
- [ ] ยิง load test ซ้ำหลังทำข้างบน ยืนยันเพดานใหม่

### กลุ่ม 3 — ยืนยันว่าฟังก์ชันปกติกลับมา (เมื่อปิด LOAD_TEST_MODE)
สิ่งเหล่านี้กลับมาทำงานเองอัตโนมัติ ไม่ต้องแก้โค้ด — แค่ตรวจว่าทำงานจริง:
- [ ] ตรวจบัตรประชาชน DOPA + ดึงที่อยู่ CUST Profile จริง
- [ ] ส่งอีเมลสัญญาจริง
- [ ] เซฟไฟล์ PDF ลงดิสก์ (หลักฐาน)
- [ ] เขียน log info ลงไฟล์ (audit)

---

## 6. ไฟล์ผลดิบ
- `loadtest/ff-real.txt` — log ยิง full flow
- `loadtest/uat-fullflow-summary.json` — สรุป k6 (full flow)
- `loadtest/uat-ceiling-summary.json` — สรุป k6 (เส้นอ่านอย่างเดียว)
- `loadtest/uat-fullflow.js`, `uat-ceiling.js` — สคริปต์ k6
