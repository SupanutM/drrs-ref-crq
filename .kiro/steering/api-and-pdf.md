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
  `/api/customer/lookup`, `/api/customer/address`
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

## การสร้างและแสดง PDF

การสร้าง PDF จริง **ทำที่ backend** ไม่ใช่ frontend:

- backend ใช้ `puppeteer` render HTML template (`drrs-api/src/templates/*.html`) เป็น PDF
  และมี `pdf-lib` / `pdfkit` ช่วยจัดการ/ใส่รหัสไฟล์
- frontend มีสองเส้นทางหลัก:
  - **base64**: `api/register.js` `generatePdfBase64()` → `/api/generate-pdf` (ใช้ใน GenContract)
  - **blob**: `generateContractPdf()` → `/api/generate-contract` ตั้ง `responseType: "blob"`
- แสดงผล PDF บนหน้าเว็บด้วย `react-pdf` (`Document`, `Page`) — ต้องตั้ง worker:
  `pdfjs.GlobalWorkerOptions.workerSrc = ...pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
- lib ฝั่ง frontend อย่าง `jspdf`/`html2canvas`/`pdfmake` มีติดตั้งไว้ แต่เส้นทางหลักคือให้ backend
  สร้างให้ เพื่อความสม่ำเสมอของสัญญา — ก่อนสร้าง PDF ฝั่ง client ให้เช็คก่อนว่ามี endpoint รองรับแล้วหรือยัง
