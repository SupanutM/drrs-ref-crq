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

## วิธีเก็บข้อมูล: "ปิดของเก่า ใส่ของใหม่" (soft-delete + insert)

ทั้งไฟล์ลูกค้าและไฟล์บัญชีใช้หลักเดียวกัน:
1. ปิดข้อมูลเดิมทั้งหมด (`status '1' → '0'` + ใส่ `delete_date` / `delete_by`)
2. ใส่ข้อมูลจากไฟล์เป็นแถวใหม่ทั้งหมด
(ไฟล์แผนต่างออกไป: upsert ตาม `CODE` ไม่ได้ลบของเก่า)

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
