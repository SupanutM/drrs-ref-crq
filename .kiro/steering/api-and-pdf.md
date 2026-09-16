---
inclusion: fileMatch
fileMatchPattern: "drrs/src/api/**|drrs/src/pages/**/services/**|drrs/src/**/PlanSummary/**|drrs/src/**/GenContract/**|drrs-api/src/routes/**|drrs-api/src/controllers/**|drrs-api/src/services/**"
---

# การเรียก API, Auth (JWT) และการทำ PDF

## ชั้นเรียก API (frontend)

- ทุก request ไป backend ต้องผ่าน `src/api/*` และใช้ `apiAxiosInstance` จาก
  `src/api/handler.js` (มี baseURL, timeout 60s, และ interceptor กลาง)
- baseURL มาจาก env `REACT_APP_BACKEND_URL` เท่านั้น อย่า hardcode URL ในโค้ด
- ลำดับการเรียก: `page/view` หรือ `page/controller` → `page/services/*` → `api/*` → backend
  อย่าเรียก axios หรือ `api/*` ตรงจาก view/controller
- ทุกฟังก์ชันใน `api/*` และ `services/*` ต้อง `try/catch`, log ด้วย `logger.error`, แล้ว `throw` ต่อ
  (ให้ชั้นบนตัดสินใจแสดงผลเอง)
- interceptor จัดการ HTTP 429 (คนใช้เยอะเกิน) ให้แล้วด้วย alert ภาษาไทย — อย่าเขียนซ้ำในแต่ละหน้า

## Auth: session token (JWT) — สำคัญมาก

ระบบใช้ JWT เป็น "บัตรผ่าน" หลังยืนยันตัวตน:

- ตอน `verify-register` สำเร็จ backend จะออก JWT (ข้างในมี `cusTargetId` + `accountNos`)
  ส่งกลับใน `data.token` — frontend เก็บผ่าน `utils/authToken.js` (`setToken`) ลง sessionStorage
- `handler.js` มี **request interceptor** แนบ `Authorization: Bearer <token>` ให้ทุก request อัตโนมัติ
  (อ่านจาก `getToken()`) — ไม่ต้องแนบเองในแต่ละ api
- ล้าง token (`clearToken`) เมื่อ: session timeout, กดออกจากระบบ (`SessionGuard`), และตอนเข้าหน้า `Consent`
- ฝั่ง backend:
  - `middleware/authMiddleware.js` บังคับ token กับ endpoint ที่ต้อง login แล้วแนบ `req.auth = { cusTargetId, accountNos }`
  - **controller ต้องอ่าน `cusTargetId` จาก `req.auth` เท่านั้น ห้ามเชื่อค่าจาก body** (กัน IDOR)
  - endpoint ที่อ้าง `accountNo` ต้องเช็ก `ownsAccount(req, accountNo)` ก่อนทำงาน
  - endpoint สาธารณะ (ไม่ต้อง token): `verify-*`, `master/*`, `/utils/encryption`, `/utils/checkCloseSystem`
- เพิ่ม endpoint ใหม่ที่แตะข้อมูลลูกค้า → ต้องใส่ `authMiddleware` และดึง identity จาก `req.auth` เสมอ

รูปแบบมาตรฐานของฟังก์ชันใน `api/`:

```js
import { apiAxiosInstance } from "./handler";
import { logger } from "utils/logger";

export const saveDebtRestructure = async (payload) => {
  try {
    const response = await apiAxiosInstance.post("/api/debt-restructure", payload);
    return response.data;
  } catch (error) {
    logger.error("Submit Debt Restructure API Error:", error);
    throw error;
  }
};
```

## Endpoint หลักของ backend (`drrs-api/`)

- prefix `/api/...` = business (ผ่าน rate limiter), `/utils/...` = utility (ผ่าน rate limiter)
- ต้อง login (มี `authMiddleware`): `/api/debt-restructure`, `/api/cancel-plan`, `/api/check-plan`,
  `/api/update-income`, `/api/generate-pdf`, `/api/generate-contract`, `/api/preview-contract-html`,
  `/api/customer/lookup`, `/api/customer/address`, `/api/cbsregister/inquiry-account`
- สาธารณะ: `/api/verify-register`, `/api/verify-cus-target`, `/api/verify-laser-id`, `/api/master/*`,
  `/utils/encryption`, `/utils/checkCloseSystem`
- `/utils/decryption` ถูก **ปิดไปแล้ว** (เคยเป็น decryption oracle เปิดสาธารณะ) — การถอดรหัสทำภายใน server เท่านั้น
- route ย่อยรวมกันใน `src/routes/router.js`; เพิ่ม endpoint ใหม่ให้ทำเป็น route -> controller -> service

## ข้อมูลอ่อนไหว / การเข้ารหัส

- ข้อมูลลูกค้าเข้ารหัสด้วย `api/crypto.js` (`encryptGCM`) → ยิงไป `/utils/encryption` (backend เข้ารหัสให้)
  ก่อนส่งข้อมูลอ่อนไหว (ชื่อ, เลขบัตร ฯลฯ) จากหน้าบ้านไปหลังบ้าน
- backend `utils/crypto.js` ใช้ AES-256-GCM แบบ **สุ่ม IV ทุกครั้ง** ผลลัพธ์รูปแบบ `iv:encrypted:tag`
  (decrypt รองรับทั้งแบบใหม่ 3 ส่วน และแบบเก่า 2 ส่วนผ่าน legacy IV)
- อย่า log ข้อมูลส่วนบุคคลดิบ (เลขบัตร, ชื่อ, ข้อมูลสินเชื่อ) ลง console/log ทั้ง frontend และ backend

การสร้าง PDF จริง **ทำที่ backend** ไม่ใช่ frontend:

- backend สร้าง PDF ด้วย **pdfkit** (`services/condition/contractPdfKitService.js`) — วาดเอง
  เป็น JS ล้วน ไม่เปิด Chromium (เดิมใช้ `puppeteer` render HTML เป็น PDF แต่เลิกใช้แล้ว
  เพราะกิน RAM/CPU ค้าง — ไม่มี `puppeteer` เหลือในโค้ดแล้ว) ยังมี `pdf-lib` ช่วยรวมหน้า/
  ใส่รหัสไฟล์ (`pdfSecurityHelper.js`)
- คืน 2 เวอร์ชันจากเอกสารชุดเดียวกัน: `preview` (ไม่ใส่รหัส สำหรับโชว์บนจอ) และ
  `download` (ใส่รหัสวันเกิดลูกค้า สำหรับดาวน์โหลด/ส่งเมล)
- หน้า preview (`preview-contract-html`) ใช้ `ejs` render `templates/loan_condition.template.html`
  เป็น HTML ธรรมดา (ไม่แปลงเป็น PDF, ไม่เปิด Chromium) แต่หน้าสัญญาจริงที่ดาวน์โหลด/ส่งเมล
  มาจาก `contractPdfKitService.js` — ต้องคำนวณวันที่/ยอดเงินให้ตรงกันทั้งสองที่
  (ดู `utils/calculateInstallmentSchedule.js` ที่ใช้ร่วมกัน)
- frontend มีสองเส้นทางหลัก:
  - **base64**: `api/register.js` `generatePdfBase64()` → `/api/generate-pdf` (ใช้ใน GenContract)
  - **base64 (JSON)**: `generateContractPdf()` → `/api/generate-contract` ตอบ
    `{ success, base64Preview, base64Download, fileName, hasPartialFailure, rejectedAccounts }`
    (ไม่ใช่ blob แล้ว)
- แสดงผล PDF บนหน้าเว็บด้วย `react-pdf` (`Document`, `Page`) — ต้องตั้ง worker:
  `pdfjs.GlobalWorkerOptions.workerSrc = ...pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
- lib ฝั่ง frontend อย่าง `jspdf`/`html2canvas`/`pdfmake` มีติดตั้งไว้ แต่เส้นทางหลักคือให้ backend
  สร้างให้ เพื่อความสม่ำเสมอของสัญญา — ก่อนสร้าง PDF ฝั่ง client ให้เช็คก่อนว่ามี endpoint รองรับแล้วหรือยัง
- สัญญาที่สร้างสำเร็จจะถูกเก็บ (preview base64) ลง `tbl_contract_file` +
  `tbl_contract_file_account` (normalize แล้ว 1 แถวต่อ 1 บัญชี พร้อม snapshot
  ยอดเงิน/ข้อมูล CBS Inquiry ณ ตอนเซ็นสัญญา — `scheduled_next_date` (ScheduledNextDate) +
  `new_maturity_date` (NewMdt วันครบกำหนด) **และ** ผลลัพธ์จาก CBS Register Digitalloan
  — `cbs_status`/`cbs_desc`/`cbs_timestamp` ตรงกับ `Status`/`Desc`/`TimeStamp` ที่ CBS ตอบมา)
  ไว้สำหรับ reprint ย้อนหลัง — ดูหัวข้อ CBS ด้านล่าง
- บัญชีที่ลงทะเบียนไปแล้ว (`isRegistered`) หน้า select-plan จะดึง `scheduled_next_date`/
  `new_maturity_date` จาก snapshot สัญญาล่าสุด (`masterPlanService.js`) มาโชว์แทนการยิง CBS ซ้ำ
  (สัญญาเก่าก่อนเพิ่ม column `new_maturity_date` จะไม่มีค่า → ซ่อนบรรทัดวันที่)

## การลงทะเบียนกับ CBS (สำคัญ — ยิงตอน "ยอมรับสัญญา")

มี CBS API 2 เส้นที่ทำงานคนละหน้าที่ อยู่ใน `services/register/`:

- **Inquiry LoanProcess** (`inquiryAccountService.js`, endpoint `CBS_INQUIRY_ACCOUNT_URL` =
  `.../inquiry/loanprocess`) — เช็คข้อมูลบัญชีล่าสุด ยิงแยกตาม `SubMethod` (spec 2026-09-15):
  - `SubMethod: "SUMALL"` (`DataInput: ""`) — คืน `DataOutput` = `crlmt#total_amount#total_bal#total_int#`
    → วงเงินกู้ / ภาระหนี้คงเหลือ / เงินต้น / ดอกเบี้ย (ใช้กับแผน Haircut และทุกจุดที่ต้องโชว์ตัวเลขเงิน)
  - `SubMethod: "NEXTPLN1"` (`DataInput: "<งวด>#"`) — คืน `DataOutput` = `new_schnd#new_mdt#` (YYYYMMDD)
    → `ScheduledNextDate` (วันเริ่มชำระงวดแรก) / `NewMdt` (วันครบกำหนด) ใช้กับ**แผนผ่อนชำระเท่านั้น**
    `<งวด>` = `installment_terms` **ต้องมีค่าเสมอ ห้ามว่าง**
  - body **ไม่มี `ServiceName`** แล้ว (spec เก่ามี — เลิกใช้) — มีแค่ `UUID`/`AccountNumber`/`SubMethod`/`DataInput`
  - แปลง `DataOutput` (คั่นด้วย `#`) ผ่าน Model เฉพาะทาง: `model/CbsLoanProcessSumAllDataModel.js`
    และ `model/CbsLoanProcessNextPln1DataModel.js` (แยก logic `.split('#')` ออกจาก service)
  - CBS อาจตอบ HTTP 200 แต่ `Status: "REJECT"` — service คืน `success: true` เสมอเมื่อ HTTP ไม่ error
    (ให้ผู้เรียกเช็ค `data.Status` เอง) **ห้าม** return `success:false` ตอน REJECT เพราะ controller
    จะตอบ HTTP non-2xx ทำให้ axios ฝั่ง frontend เข้า `.catch()` แทน `.then()` (logic เช็ค Status พัง)
  - **วันครบกำหนด (`NewMdt`) ใช้ตรงๆ เท่านั้น ห้ามคำนวณเองจาก `ScheduledNextDate + installmentTerms`**
    (CBS คิดวันหยุด/รอบตัดบัญชีร่วมด้วย คำนวณเองได้วันผิด — เคยเป็นบั๊กจริง) ถ้า CBS ไม่ส่งมา
    ให้โชว์ว่างเปล่า (ซ่อนบรรทัด) ไม่เดาวันที่ — ดู `utils/calculateInstallmentSchedule.js`
  - จุดที่ยิง: หน้า select-plan (prefetch, `source: "select-plan"` — ยิงรอบเดียว: มีแผนผ่อน→`NEXTPLN1`,
    ไม่มี→`SUMALL`; ข้ามบัญชีที่ `isRegistered` แล้ว), preview (`source: "preview"`), ยอมรับสัญญา
    (`contractHelper.js augmentAccountsWithCbsData` ยิง `SUMALL` เสมอ + `NEXTPLN1` เพิ่มถ้าแผนผ่อน)
  - บันทึกประวัติลง `tbl_system_log` (step `CBS_INQUIRY_ACCOUNT`) เฉพาะตอนยอมรับสัญญาจริงเท่านั้น
    (ไม่บันทึกถ้า `source` เป็น `select-plan`/`preview` — กันบันทึกซ้ำ)
- **Register Digitalloan** (`registerDigitalLoanService.js`) — ลงทะเบียนแผนที่ลูกค้าเลือกกับ
  CBS จริง ยิง **ครั้งเดียวตอนกดยอมรับสัญญา** ก่อนสร้าง PDF เสมอ
  (`downloadAndEmailContractPdfController.js` STEP 1 ก่อน STEP 2 สร้าง PDF)
  - CBS อาจตอบ HTTP 200 แต่ `Status: "REJECT"` ในตัว body — **ต้องเช็ค `Status` เสมอ**
    ไม่ใช่แค่เช็คว่า request สำเร็จ
  - ถ้าบางบัญชีถูก reject: PDF จะสร้างเฉพาะบัญชีที่ CBS ตอบ `SUCCESS` (`successAccounts`)
    ไม่ตั้ง `stepSendToCbs` ให้บัญชีที่ reject (กลับมาเลือกแผนใหม่ได้) และตอบ
    `hasPartialFailure: true` + `rejectedAccounts` ให้ frontend เตือนก่อนดาวน์โหลด
  - ถ้า**ทุกบัญชี**ถูก reject: ไม่สร้าง PDF/ไม่ส่งเมลเลย ตอบ `success: false`
- endpoint ฝั่ง frontend เรียกผ่าน `api/cbsRegister.js` (`inquiryAccount()`)
  → `POST /api/cbsregister/inquiry-account`
- ทั้งสอง service ขอ Bearer token จาก SSO ก่อนทุกครั้ง (`getAccessTokenService.js`)

## แนวทาง Log (สำคัญ)

Log มี 2 ส่วน: debug log (ไฟล์ `drrs-api/logs/`) กับ audit log (DB `tbl_system_log`)

หลักการ:
- **ข้อมูลการลงทะเบียน + รายได้ + คำนวณรายได้สุทธิ** → ให้เก็บละเอียดใน debug log ได้เลย
  ต้องตรวจสอบย้อนหลังได้เร็ว อ้างอิงด้วย `cusTargetId`
- ให้ทุก log สำคัญมี `cusTargetId` และ/หรือ `accountNo` — ค้นคำเดียวเจอทุกเรื่องของลูกค้าคนนั้น
- log ที่ไม่เกี่ยวกับการตรวจสอบ (เช่น ที่อยู่, ข้อมูลจาก CUST API) → log เฉพาะผล (สำเร็จ/ล้มเหลว) โดยไม่ dump ค่า
- ความปลอดภัยเรื่อง PII ใน log มีทีม prod ดูแล ไม่ต้องปิดบังจนตรวจสอบไม่ได้

ตัวอย่าง log ที่ต้องชัดเจน:
- `[Update Income] cusTargetId: 42 | totalIncome: 50000 | netIncome: 49000`
- `[Income Guard] cusTargetId: 42 | netIncome: 49000 >= totalMinAmount: 6000`
- `[checkIncomeService] ผลสรุป | cusTargetId: 42 | isValid: true`
- `[Registration] ยืนยันตัวตนสำเร็จ | cusTargetId: 42 | accounts: 0001, 0002`
