# Project Structure

Repo นี้มี 2 ส่วนหลัก (frontend + backend แยกโฟลเดอร์กัน):

- `drrs/`     — React frontend (Create React App)
- `drrs-api/` — Node.js/Express backend (TypeORM + PostgreSQL)

## Frontend (`drrs/`)

```
drrs/
├── public/
│   ├── config.js          # runtime config -> window.APP_CONFIG
│   └── contract*.pdf      # ไฟล์สัญญาตัวอย่าง
└── src/
    ├── api/               # ชั้นเรียก backend ด้วย axios (handler, register, crypto, verify, master ...)
    ├── assets/            # css, fonts (ไทย), images, theme (Material Kit)
    ├── components/        # คอมโพเนนต์ใช้ซ้ำ (MK* และ SessionGuard)
    ├── examples/          # คอมโพเนนต์จากเทมเพลต (Navbars, Cards, Footer)
    ├── layouts/pages/landing-pages/<name>/   # wrapper บางๆ ต่อ route -> เรียกหน้าจริง
    ├── pages/LandingPages/<Name>/            # ★ หน้าจริงของ DRRS (โค้ดหลักอยู่ที่นี่)
    ├── utils/             # helper: logger, validators, session, date, authToken (JWT)
    ├── App.js             # ประกาศ Routes ทั้งหมด
    └── index.js           # entry point
```

### สถาปัตยกรรมของแต่ละหน้า (สำคัญมาก)

หนึ่งหน้ามี 3 ชั้น กระจายเป็น 3 ที่:

1. **Route** ใน `App.js` ชี้ไปที่ wrapper ใน `layouts/pages/landing-pages/<name>/index.js`
2. **Wrapper** แค่ import แล้ว render หน้าจริงจาก `pages/LandingPages/<Name>`
3. **หน้าจริง** `pages/LandingPages/<Name>/` แยกเป็น layer:
   - `index.js` — shell/layout ของหน้า (navbar, banner) แล้วเรียก controller
   - `page/controller/` — จัดการ state และ logic ของหน้า
   - `page/services/` — เรียก `api/*` (ไม่เรียก axios ตรง)
   - `page/view/` — ส่วนแสดงผล (presentational)

หน้าจริงของ DRRS: Consent, FormRegister, LoanPlan, LoanPlanDetails,
SelectPlan, PlanPreview, PlanSummary, GenContract

## Backend (`drrs-api/`)

```
drrs-api/
├── server.js              # entry: express + CORS + rate limiter, ต่อ /api และ /utils
└── src/
    ├── config/            # database (TypeORM DataSource), env (ตรวจ required env vars)
    ├── routes/            # router.js รวม route ย่อย (debtRestructure, pdf, customer, verify, util ...)
    ├── middleware/        # authMiddleware.js (บังคับ JWT + ownsAccount กัน IDOR)
    ├── controllers/       # รับ request -> เรียก service
    ├── services/          # business logic (รวมสร้าง PDF)
    ├── entities/ model/   # TypeORM entities / data models
    ├── templates/         # HTML template สำหรับ render เป็น PDF (planSummary.html ฯลฯ)
    └── utils/             # logger (winston), rateLimiter, crypto (AES-GCM), jwt (sign/verify) ฯลฯ
```

- รันด้วย `npm run dev` (nodemon) ใน `drrs-api/`, ฟังพอร์ต `5000`
- endpoint ขึ้นต้น `/api/...` (business) และ `/utils/...` (utility) ผ่าน rate limiter
- endpoint ที่ต้อง login ต้องมี `authMiddleware` (ดูรายละเอียดใน steering `api-and-pdf`)

## กฎการวางไฟล์

- **หน้าใหม่ของ DRRS**: สร้างโฟลเดอร์ใน `pages/LandingPages/<Name>/` ตาม layer
  (`index.js` + `page/controller|services|view`), ทำ wrapper ใน `layouts/pages/landing-pages/<name>/`
  แล้วเพิ่ม `<Route>` ใน `App.js` (ครอบด้วย `<SessionGuard>` ถ้าต้องมี session)
- **เรียก backend**: ผ่านชั้น `src/api/*` เท่านั้น และให้ `page/services/` เป็นตัวเรียก api
  อย่าเรียก axios หรือ api ตรงจาก view/controller
- **helper / validation**: วางใน `src/utils/` และ import แบบ absolute (`utils/...`)
- **การ log**: frontend ใช้ `logger` จาก `utils/logger`; backend ใช้ winston logger — ห้าม `console.log` ตรงๆ

## การจัดการ Session (สำคัญ)

- `SessionGuard` (`components/SessionGuard/`) ป้องกันทุกหน้าหลัง consent
- `utils/useSessionTimeout.js` — idle timeout + warning dialog (อ่านค่าจาก `appConfig`)
- `utils/useTabLimit.js` — จำกัดจำนวน tab พร้อมกันตาม `MAX_CONNECTIONS`
- `utils/authToken.js` — เก็บ/อ่าน/ล้าง JWT ใน sessionStorage; ล้าง token เมื่อ timeout/ออกจากระบบ/เข้าหน้า consent
- แก้พฤติกรรม timeout/warning ที่ `public/config.js` และ hook ข้างบน อย่า hardcode ตัวเลขในหน้า

## ข้อควรระวังเรื่องเทมเพลต

โปรเจกต์ยังมีไฟล์ตัวอย่างจาก Material Kit 2 (`layouts/sections/`, `examples/`, `routes.js`)
ปนอยู่ ให้แก้เฉพาะส่วน DRRS จริง อย่าไปยุ่งกับไฟล์เทมเพลตที่ไม่ได้ใช้เว้นแต่จำเป็น
