---
inclusion: fileMatch
fileMatchPattern: "drrs-api/src/services/admin/targetDataImportService.js|drrs-api/src/controllers/admin/targetDataImportController.js|drrs-api/src/services/admin/masterDataImportService.js|drrs-api/src/routes/adminTargetDataRoutes.js|drrs-api/src/routes/adminMasterDataRoutes.js|drrs/src/pages/LandingPages/AdminTargetImport/**|drrs/src/pages/LandingPages/AdminMasterImport/**"
---

# การนำเข้าข้อมูล (Import) ฝั่ง Admin

สรุปแบบเข้าใจง่ายว่าไฟล์ import แต่ละตัวเข้าตารางไหน อ่านยังไง และมีกฎอะไรห้ามพลาด

## ไฟล์ที่ระบบรับ

| ไฟล์ | เข้าตาราง | นามสกุล |
|------|-----------|---------|
| `U_DRRS_CUS_TARGET_YYYYMMDD.csv` (ข้อมูลลูกค้า) | `tbl_cus_target` | `.csv` เท่านั้น |
| `U_DRRS_ACCOUNT_TARGET_YYYYMMDD.csv` (ข้อมูลบัญชี) | `tbl_account_cus_target` | `.csv` เท่านั้น |
| ไฟล์แผน (plan) | `tbl_mt_master_plan` | `.csv` เท่านั้น |
| master data (จังหวัด/อำเภอ/ตำบล) | ตาราง master | `.xlsx` หรือ `.csv` |

โค้ดหลัก: `drrs-api/src/services/admin/targetDataImportService.js`
รับไฟล์: `drrs-api/src/controllers/admin/targetDataImportController.js`

## รูปแบบไฟล์ target (สำคัญ)

- คั่นด้วย pipe `|` **ไม่มีหัวตาราง (header)** ตำแหน่งคอลัมน์คงที่ตามลำดับ
- **ต้องเป็น `.csv` ดิบเท่านั้น** ห้ามไฟล์ที่เคยเปิด/แปลงเป็น `.xlsx` มาก่อน เพราะเลขบัตรประชาชนจะเพี้ยน
- encoding เดาอัตโนมัติ: ลอง UTF-8 ก่อน ถ้าไม่ใช่ค่อย fallback เป็น Windows-874 (TIS-620)
  อย่า hardcode encoding ตายตัว (ไฟล์จริงจากทีมข้อมูลมีทั้งสองแบบปนกัน)

### คอลัมน์ไฟล์ลูกค้า (`tbl_cus_target`)
`CIF_NO | CITIZEN_ID | FIRST_NAME | LAST_NAME | VERIFY_CODE | TYPE`
- 5 คอลัมน์แรกต้องมีครบ ไม่ครบ = ข้ามแถวนั้น (เก็บ error ไว้)

### คอลัมน์ไฟล์บัญชี (`tbl_account_cus_target`)
`ACCOUNT_NO | CIF_NO | PLAN_NO | PAYMENT_AMOUNT | INSTALLMENT_TERMS | EXPIRE_DATE`
- 3 คอลัมน์แรกต้องมีครบ
- `EXPIRE_DATE` (รูปแบบ `YYYYMMDD`) เป็น optional ไม่มีก็ได้ (เก็บเป็น null)
- เชื่อมกับลูกค้าด้วย `CIF_NO` **ดังนั้นต้อง import ไฟล์ลูกค้าก่อนไฟล์บัญชีเสมอ**

## ลำดับการ import (ห้ามสลับ)

**ลูกค้า → บัญชี → แผน**
ไฟล์บัญชีต้องอ้าง `CIF_NO` ที่มีในไฟล์ลูกค้า ถ้า import บัญชีก่อนจะหาลูกค้าไม่เจอ
(ไฟล์แผนไม่ผูกกับ 2 ไฟล์แรก import อิสระได้)

## วิธีเก็บข้อมูล (ต่างกันตามไฟล์)

**ไฟล์ลูกค้า** (`tbl_cus_target`) — **upsert ตาม `CIF_NO`** (แก้บั๊ก 2026-09-15, เดิมเป็น
full-refresh ปิดของเก่าทั้งหมดแล้ว insert ใหม่ทุกครั้ง ทำให้ `cus_target_id` เปลี่ยนทุกรอบ import
แม้เป็นลูกค้าคนเดิม — พังกับไฟล์บัญชีที่เป็น delta เพราะบัญชีที่ไม่ได้อยู่ในไฟล์บัญชีรอบนั้นจะยังชี้
ไปที่ `cus_target_id` เดิมที่ถูกปิดไปแล้ว):
- `CIF_NO` ตรงกับลูกค้า active ที่มีอยู่แล้ว → **UPDATE** แถวเดิม (คง `id` เดิมไว้เสมอ)
- `CIF_NO` ตรงกับลูกค้าที่ถูก soft-delete ไว้ (`status='0'`) → **REVIVE แถวเดิม** (`status` กลับเป็น `'1'`
  + ล้าง `delete_date`/`delete_by`) คง `id` เดิมไว้ **ห้าม INSERT แถวใหม่** (แก้บั๊ก 2026-09-22 ดูหัวข้อ
  "กฎเหล็ก: ห้าม insert แถวใหม่ให้ลูกค้าที่เคยถูกลบ" ด้านล่าง)
- `CIF_NO` ใหม่ ไม่ตรงกับใคร → INSERT แถวใหม่
- ลูกค้า active ที่หายไปจากไฟล์รอบนี้ → soft-delete (`status '1' → '0'` + `delete_date`/`delete_by`)
  **ยกเว้น** มีบัญชีที่ `step_send_to_cbs = '1'` (ส่ง CBS สำเร็จแล้ว) ห้าม soft-delete เด็ดขาด
  (กฎเดียวกับที่ป้องกันบัญชีในไฟล์บัญชี — กันไฟล์ตกหล่นบางวันแล้วลูกค้าที่ลงทะเบียนสำเร็จหายไป)

**ไฟล์บัญชี** (`tbl_account_cus_target`) — **delta (ไม่ใช่ full-refresh)**:
soft-delete **เฉพาะ** บัญชี+แผน (`account_no` + `plan_no`) ที่มีในไฟล์รอบนี้ แล้วแทนด้วยแถวใหม่
บัญชี/แผนที่**ไม่ได้อยู่ในไฟล์รอบนี้ ไม่ถูกแตะ** (คงข้อมูลเดิมไว้)
→ import ไฟล์ 2 แถว จะกระทบแค่ 2 บัญชี+แผนนั้น ไม่ปิดบัญชีอื่นทิ้ง

**ไฟล์แผน** (`tbl_mt_master_plan`) — upsert ตาม `CODE` ไม่ลบของเก่า

## ★ กฎเหล็ก: ห้าม insert แถวใหม่ให้ลูกค้าที่เคยถูกลบ (ต้อง revive)

ไฟล์ลูกค้าเป็น **full-refresh** (ไม่มีในไฟล์ = soft-delete) แต่ไฟล์บัญชีเป็น **delta** (ไม่มีในไฟล์ =
ไม่แตะ) สองอันไม่สมมาตรกัน ถ้าจับคู่ `CIF_NO` เฉพาะลูกค้า `status='1'` จะเกิดทางเดินบั๊กนี้:

| วัน | เหตุการณ์ | ผล |
|-----|-----------|-----|
| 1 | ลูกค้า A (CIF 5004) อยู่ในไฟล์ | `cus_target_id = 10`, บัญชีของ A ชี้ id 10 |
| 2 | ไฟล์ตกหล่น ไม่มี A | A ถูก soft-delete (id 10 ตาย) แต่บัญชียังชี้ id 10 |
| 3 | A กลับมาในไฟล์ | หาไม่เจอเพราะดูแต่ active → insert ใหม่เป็น id 77 |

ผลลัพธ์: A ใช้ id 77 แต่บัญชีเก่าที่ไฟล์บัญชีไม่ได้ส่งมาซ้ำยังผูก id 10 ที่ตายแล้ว **ถาวร**
→ ลูกค้าเข้าระบบมาไม่เห็นบัญชีตัวเอง

**กฎ:** จับคู่ `CIF_NO` กับลูกค้า **ทุก status** แล้วปลุกแถวเดิมกลับ ห้ามสร้าง `cus_target_id` ใหม่
ให้คนเดิมเด็ดขาด

**กรณี CIF เดียวมีหลายแถวค้าง** (ตกค้างจากยุค full-refresh) เลือกแถวตัวแทนตามลำดับนี้
(`pickCustomerRow` ใน service):
1. แถว active ที่มีบัญชี active ผูกอยู่
2. แถว active อื่น — `id` น้อยสุด (ดั้งเดิมที่สุด)
3. แถวที่ถูกลบแต่มีบัญชี active ผูกอยู่ — `id` มากสุด ← แถวเดียวที่ปลุกแล้วแก้อาการบัญชีหลุดได้จริง
4. แถวที่ถูกลบล่าสุด — `id` มากสุด

**log:** ทุกครั้งที่มีการ revive ต้อง `logger.warn` แยกอีกบรรทัด (เป็นเคสผิดปกติที่ต้องตามดู) และส่ง
`revived` / `revivedCusTargetIds` กลับไปใน `data` ให้ลง `tbl_admin_system_log` ด้วย
log ได้แค่ **`cus_target_id`** เท่านั้น ห้าม log `CIF_NO` / เลขบัตร / ชื่อ

## ★ กฎเหล็ก: แถวซ้ำในไฟล์เดียวกัน → เชื่อแถวล่าสุด + แจ้งเตือน

ตัดแถวซ้ำ **ก่อน**เข้า DB ด้วย `dedupeKeepLast()` (helper ร่วมใน service) นโยบาย:
**แถวที่อยู่ล่างกว่าในไฟล์ชนะเสมอ**

| ไฟล์ | key ที่ใช้ตัดซ้ำ |
|------|-----------------|
| ลูกค้า | `CIF_NO` |
| บัญชี | `account_no` + `plan_no` (key เดียวกับที่ใช้จับคู่ของเก่า/ของใหม่) |
| แผน | ไม่ต้องตัด — `importPlan` ทำ `findOne` ใหม่ทุกแถวใน loop แถวหลังจึง update ทับแถวแรกเองอยู่แล้ว |

**ทำไมต้องตัด:** map ที่ใช้จับคู่ของเก่ากับของใหม่ (`customerByCifNo` / `existingByKey`) สร้างจาก
ข้อมูลใน DB **ครั้งเดียวก่อนเข้า loop** และ `insert` เกิดขึ้น**หลัง** loop จบ แถวซ้ำแถวที่ 2 จึงมองไม่เห็น
แถวที่ 1 → ได้แถว active key เดียวกันซ้อน 2 แถว
(เกิดเฉพาะ key ที่ยังไม่มีใน DB เลย ถ้ามีอยู่แล้วทั้งคู่จะเข้าทาง update ทับกันเอง)
แถวซ้ำใน `tbl_cus_target` ยังทำให้ `importCustomer` กับ `importAccount` เลือกแถวคนละแถวได้ด้วย
(`importAccount` ใช้ `new Map(...)` ที่ไม่มี `ORDER BY` = ลำดับไม่การันตี)

**ต้องแจ้งเตือน ไม่ใช่เงียบ** — นับเป็น "สำเร็จ" (ไม่ใช่ error) แต่ต้องบอกเจ้าหน้าที่ทุกครั้ง:
- service ส่ง `warnings` (ข้อความรายรายการ จำกัด `DUP_WARNING_LIMIT = 200`) + `duplicateCount`
  (จำนวนจริงทั้งหมด ไม่ถูกจำกัด) กลับไปใน `data`
- `logger.warn` แยกอีกบรรทัด — log แค่**จำนวน** ห้าม log CIF/เลขบัญชี (รายละเอียดไปอยู่ใน
  `tbl_admin_system_log` พร้อม response แล้ว)
- หน้าเว็บ: แถบเตือนสีเหลืองด้านบน (ไม่ปิดเอง ต่างจากแถบสำเร็จที่ปิดเองใน 5 วิ) + รายละเอียด
  3 รายการแรกในกล่องผลลัพธ์ของไฟล์นั้น

## กฎเรื่อง CIF ไม่ตรง (ไฟล์บัญชี)

- **บาง CIF ไม่ตรง** → ข้ามเฉพาะแถวนั้น แถวที่เหลือ import ต่อ + เก็บข้อความ error
- **ทุก CIF ไม่ตรงเลย** → ยกเลิกทั้งหมด **ไม่ลบข้อมูลเก่า** (กันล้างข้อมูลทิ้งเปล่าๆ)

## แยก array ตามแผนก่อนตัดสินใจ

ไฟล์บัญชีมี `PLAN_NO`: **`1` = ปิดบัญชี, `2` = ผ่อนชำระ**
ตอน import ให้อ่าน .csv แล้วแยกแถวออกเป็น array รายแผน (`{ "1": [...], "2": [...] }`) ก่อน
เพื่อให้ logic ชัด + ตรวจ audit log ได้ง่าย แต่ละแผนมีกฎของตัวเอง (แผน 1 เช็ค expire เพิ่ม)

การจับคู่ของเก่ากับของใหม่ ใช้ key = **`account_no` + `plan_no`**

## ★ กฎเหล็ก: เงื่อนไข "คงของเก่าไว้" (skip ไม่ import ใหม่)

ตอน import ไฟล์บัญชี ตัดสินใจ **รายแถว** เรียงตามลำดับความสำคัญนี้ ถ้าเข้าเงื่อนไขไหนให้คงแถวเก่าไว้
(ไม่ soft-delete + ไม่ insert ใหม่) แล้วแตะ `update_date` / `update_by` ของแถวเดิมแทน
เพื่อบันทึกว่ามีไฟล์ import ส่งซ้ำเข้ามา:

1. **skip (send to CBS success)** — บัญชีนั้นมี `tbl_settings_step.step_send_to_cbs = '1'`
   (ลูกค้าลงทะเบียนสำเร็จแล้ว) ห้ามลบเด็ดขาด ต้องคงไว้เพื่อตรวจสอบย้อนหลัง
   (`step_send_to_cbs` เป็น bpchar อาจมี space ต้อง `TRIM` ก่อนเทียบ `'1'` เสมอ)
2. **skip (not expired)** — เฉพาะ **แผน 1 (ปิดบัญชี)** เท่านั้น: ถ้าแถวเก่ายังมี `expire_date`
   ที่ยังไม่หมดอายุ (`> วันนี้`) ห้าม import ทับ — เคสนี้ให้เจ้าหน้าที่ทำมือเท่านั้น
   (แผน 2 ไม่เช็ค expire; `expire_date` เป็น null ถือว่าหมดอายุ → import ตามปกติ)
   - **นโยบายวันหมดอายุ:** `expire_date` ที่ตรงกับ "วันนี้" ถือว่า **หมดอายุแล้ว** (ต้อง `> วันนี้`
     เท่านั้นถึงจะยัง skip)
   - **เทียบแบบวันที่ล้วนๆ:** ต้องใช้ `nowBangkokDateOnly()` (จาก `utils/calculateInstallmentSchedule`)
     ไม่ใช่ `new Date()` ตรงๆ เพราะ `parseDbDate` คืนค่าเป็นเที่ยงคืน UTC ของวันนั้น ถ้าเทียบกับเวลา
     ปัจจุบันจริงผลจะเปลี่ยนไปมาภายในวันเดียวกันตามชั่วโมงที่รัน import (bug ที่แก้ไปแล้ว)

นอกเหนือจาก 2 ข้อนี้ → soft-delete ของเก่า + insert แถวใหม่จากไฟล์ (พฤติกรรมปกติ)

## audit log แยกตามแผน

log สรุปแยกนับต่อแผน เช่น:
`แผน1: insert=5 skip(not expired)=2 skip(send to CBS success)=1 | แผน2: insert=8 skip(send to CBS success)=1`

## ยอดเงินที่ส่งเข้า CBS Register Digitalloan (ทศนิยม 2 ตำแหน่ง)

ตอน "ยอมรับสัญญา" ระบบยิงแผนเข้า CBS ผ่าน `registerDigitalLoanService.js`
ยอดเงิน (`Plan1Balance`, `Plan2PaymentAmt`) **ต้องเป็น string ทศนิยม 2 ตำแหน่งเสมอ** ตาม spec CBS
(เช่น `1500` → `"1500.00"`, `600.5` → `"600.50"`) ใช้ helper `formatAmount2()` ในไฟล์นั้น
อย่าส่ง `String(amount)` ตรงๆ เพราะจะได้ `"1500"` / `"600.5"` ที่ไม่ตรง spec
- `Plan2Month` (จำนวนงวด) ส่งเป็น **เลขจำนวนเต็ม (number)** ไม่ใช่ทศนิยม
- `Plan1ExpireDate` เป็นวันที่ `YYYYMMDD` ไม่ใช่ยอดเงิน
- field ของแผนที่ไม่ได้เลือก ส่งเป็นค่าว่าง `""`

## เรื่องตัวหนังสือไทยเพี้ยนตอน insert

DB server เป็น encoding WIN874 แต่ backend ส่ง UTF-8 ทุก transaction ที่ insert ข้อมูลไทยต้องสั่ง
`SET LOCAL client_encoding TO 'UTF8'` ก่อน (ผูกกับ transaction นั้น) ไม่งั้น insert ตัวอักษรไทยไม่ได้

## ข้อควรระวังเวลาแก้โค้ด

- แบ่ง insert เป็น batch (`BATCH_SIZE = 1000`) กันชน parameter limit ของ PostgreSQL (65535)
- ถ้าทุกแถวไม่ผ่าน validation ห้าม soft-delete ของเก่าทิ้งโดยไม่มีของใหม่มาแทน
- `min_amount` / `max_amount` ไม่ใช้จากไฟล์แล้ว (ใช้ `payment_amount` แทน) ปล่อย null
- log ด้วย winston logger เท่านั้น ห้าม `console.log` และห้าม log ข้อมูลส่วนบุคคล
  (เลขบัตรประชาชน) ออก console
- ทุกการ import บันทึก audit ลง `tbl_admin_system_log` (แยกจาก log ลูกค้า)
