# วิธีรัน k6 Load Test (DRRS)

ทุกคำสั่งรันในโฟลเดอร์ `drrs-api/loadtest/`
(เปิด cmd/powershell แล้ว `cd drrs-api\loadtest` ก่อน)

ต้องมี **k6** ติดตั้งไว้ (เช็คด้วย `k6 version`)
ปรับ `BASE_URL` ให้ตรงกับ backend ที่จะยิง (ตัวอย่างเป็น UAT)

---

## แบบ 1 — เส้นอ่านอย่างเดียว (หาเพดาน, ไม่แตะข้อมูลจริง)

ยิง `POST /api/checkCloseSystem` ไล่ขั้น req/s หาจุดที่ระบบเริ่มพัง
ปลอดภัยสุด ไม่เขียน DB ไม่ต้องเตรียมอะไร

```
k6 run -e BASE_URL=http://10.22.51.190/drrs-api uat-ceiling.js
```

ปรับได้ (ใส่เพิ่มหลัง -e):
- `-e RATES=50,100,200,300` รายการ req/s แต่ละขั้น (default 20,50,100,200,400)
- `-e STEP_DUR=30s` เวลาต่อขั้น
- `-e MAX_P95=1500` เบรกถ้า p95 เกินค่านี้ (ms)
- `-e MAX_FAIL=0.02` เบรกถ้าล้มเกิน 2%

---

## แบบ 2 — Full Flow จริง (verify -> สร้างสัญญา PDF)

**ต้องทำ 3 ขั้นตามลำดับ**

### ขั้นที่ 1: seed ข้อมูลลูกค้าปลอมลง schema `loadtest` (ทำครั้งเดียว)

รัน SQL `seed-loadtest-data.sql` บน DB (สร้าง 10,000 ราย)
หรือใช้ runner:

```
node seed-loadtest-runner.js
```

> ข้อมูล seed: ชื่อ `ทดสอบ`, นามสกุล `loadtest-00001`..`loadtest-10000`, verify_code `0000`

### ขั้นที่ 2: เตรียม payload เข้ารหัส (k6 encrypt เองไม่ได้)

```
node gen-flow-payloads.js
```

สร้างไฟล์ `flow-payloads.json` (default seq 2..10000)
ปรับช่วงได้ด้วย env (เลี่ยงรายที่ยิงไปแล้ว — 1 ราย ยิงได้ครั้งเดียว):

```
set FROM=3000&& set COUNT=6000&& node gen-flow-payloads.js
```

> อ่าน `CRYPTO_KEY` จาก `../.env.uat` — ต้องตรงกับ key ของ backend ที่จะยิง

### ขั้นที่ 3: ยิง k6

```
k6 run -e BASE_URL=http://10.22.51.190/drrs-api uat-fullflow.js
```

ปรับได้:
- `-e RATES=20,50,100,200,300`
- `-e STEP_DUR=30s`
- `-e MAX_P95=5000` (full flow หนักกว่า ตั้งสูงกว่าเส้นอ่าน)
- `-e MAX_FAIL=0.02`

---

## เงื่อนไขสำคัญของ Full Flow

1. **backend ต้องตั้ง `LOAD_TEST_MODE=true`** — ข้าม DOPA/CUST API ภายนอก + ลด Disk IO
2. **backend ต้องชี้ `DB_SCHEMA=loadtest`** — ใช้ข้อมูลปลอม
3. **1 ราย ยิงได้ครั้งเดียว** — พอสร้างสัญญาเสร็จ ราย นั้นถูก block (ลงทะเบียนครบ)
   ยิงรอบใหม่ต้อง gen payload ด้วย `FROM` ที่ยังไม่เคยใช้ หรือ seed เพิ่ม
4. ยิงเยอะกว่าจำนวน payload ที่ gen ไว้ไม่ได้ (จะวนใช้ราย ซ้ำ = โดน block)

---

## เก็บผล

- ผลสรุปโชว์บนจอตอนจบ + เขียนไฟล์ `uat-fullflow-summary.json` / `uat-ceiling-summary.json`
- เก็บ log เต็มด้วยการ redirect: เติม `> result.txt 2>&1` ท้ายคำสั่ง

## หลังเทสต์เสร็จ (ก่อนขึ้น prod)

- ปิด `LOAD_TEST_MODE` (ลบ/false)
- ลบ schema `loadtest`
- ชี้ `DB_SCHEMA` กลับ `drrs`
