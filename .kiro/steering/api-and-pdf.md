---
inclusion: fileMatch
fileMatchPattern: "drrs/src/api/**|drrs/src/pages/**/services/**|drrs/src/**/PlanSummary/**|drrs/src/**/GenContract/**|drrs-api/src/routes/**|drrs-api/src/controllers/**|drrs-api/src/services/**"
---

# การเรียก API และการทำ PDF

## ชั้นเรียก API (frontend)

- ทุก request ไป backend ต้องผ่าน `src/api/*` และใช้ `apiAxiosInstance` จาก
  `src/api/handler.js` (มี baseURL, timeout 60s, และ interceptor กลาง)
- baseURL มาจาก env `REACT_APP_BACKEND_URL` เท่านั้น อย่า hardcode URL ในโค้ด
- ลำดับการเรียก: `page/view` หรือ `page/controller` → `page/services/*` → `api/*` → backend
  อย่าเรียก axios หรือ `api/*` ตรงจาก view/controller
- ทุกฟังก์ชันใน `api/*` และ `services/*` ต้อง `try/catch`, log ด้วย `logger.error`, แล้ว `throw` ต่อ
  (ให้ชั้นบนตัดสินใจแสดงผลเอง)
- interceptor จัดการ HTTP 429 (คนใช้เยอะเกิน) ให้แล้วด้วย alert ภาษาไทย — อย่าเขียนซ้ำในแต่ละหน้า

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

- prefix `/api/...` = business (ผ่าน rate limiter), `/utils/...` = encrypt/decrypt
- ตัวอย่างที่ใช้อยู่: `/api/debt-restructure`, `/api/cancel-plan`, `/api/generate-pdf`,
  `/api/generate-contract`, `/api/preview-contract-html`, `/api/checkCloseSystem`,
  `/utils/encryption`, `/utils/decryption`
- route ย่อยรวมกันใน `src/routes/router.js`; เพิ่ม endpoint ใหม่ให้ทำเป็น route -> controller -> service

## ข้อมูลอ่อนไหว / การเข้ารหัส

- ข้อมูลลูกค้า (เช่น customerInfo) เข้ารหัสด้วย `api/crypto.js` (`encryptGCM`) ก่อนส่งไป endpoint
  ที่สร้างสัญญา — ดูตัวอย่างที่ `PlanSummary` ส่ง `encryptedCustomer`
- อย่า log ข้อมูลส่วนบุคคลดิบ (เลขบัตร, ชื่อ, ข้อมูลสินเชื่อ) ลง console/production

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
