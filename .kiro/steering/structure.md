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
    ├── api/               # ชั้นเรียก backend ด้วย axios (handler, register, cbsRegister, crypto, verify, master ...)
    ├── assets/            # css, fonts (ไทย), images, theme (Material Kit)
    ├── components/        # คอมโพเนนต์ใช้ซ้ำ (MK*, SessionGuard, InstallmentSchedule ฯลฯ)
    ├── examples/          # คอมโพเนนต์จากเทมเพลต (Navbars, Cards, Footer)
    ├── layouts/pages/landing-pages/<name>/   # wrapper บางๆ ต่อ route -> เรียกหน้าจริง
    ├── pages/LandingPages/<Name>/            # ★ หน้าจริงของ DRRS (โค้ดหลักอยู่ที่นี่)
    ├── utils/             # helper: logger, validators, session, day.js (วันที่/ScheduledNextDate), authToken (JWT)
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

หน้าจริงของ DRRS (ฝั่งลูกค้า): Consent, FormRegister, LoanPlan, LoanPlanDetails,
SelectPlan, PlanPreview, PlanSummary, GenContract

### ฝั่ง Admin (โครงสร้างเดียวกันกับข้างบน แต่แยก session/auth เด็ดขาด)

หน้าจริงของฝั่ง admin: AdminLogin, AdminMasterImport, AdminTargetImport,
AdminContractReprint, AdminUserManage — ทุกหน้าอยู่ใต้ `/drrs/admin/*` และครอบด้วย
`AdminGuard` (`components/AdminGuard/`) ยกเว้นหน้า login

- `components/AdminNavbar/` — แถบเมนูบนของทุกหน้า admin (รวมเมนูนำเข้าข้อมูลไว้ dropdown เดียว,
  แสดง role เป็น chip แทน username, ปุ่ม logout)
- `components/AdminGuard/` — เช็ค token + role (`requireAdmin`/`requireSuperAdmin` prop) ก่อนเข้าหน้า
  ไม่ผ่านเงื่อนไข role จะเด้งไปหน้า `contract-reprint` เสมอ (ไม่ใช่ login ถ้ามี token อยู่แล้ว)
- `utils/adminAuthToken.js` — เก็บ/อ่าน/ล้าง admin JWT + profile ใน sessionStorage คนละ key จาก
  customer token (`utils/authToken.js`) เด็ดขาด กันสับสน/ใช้ข้ามฝั่งกัน
- `api/admin.js` + `api/adminHandler.js` — axios instance แยกจาก customer, แนบ admin token อัตโนมัติ
- Login สำเร็จ (ไม่ว่า role อะไร) พาไปหน้า `contract-reprint` เสมอ — ADMIN/SUPERADMIN ที่ต้องเข้า
  หน้านำเข้าข้อมูล/จัดการสิทธิ์ให้กดเมนูบน AdminNavbar เอง ไม่ auto-redirect ให้

**สิทธิ์แบบลำดับชั้น (hierarchy)** เก็บใน `tbl_admin_user.role`: `NULL` (ผู้ใช้ทั่วไป — reprint
สัญญาได้อย่างเดียว, ไม่มีแถวเก็บไว้จริงในตาราง) → `'ADMIN'` (นำเข้า master/target data ได้เพิ่ม)
→ `'SUPERADMIN'` (ทำได้ทุกอย่างของ ADMIN + จัดการสิทธิ์ผู้ใช้ admin คนอื่นในหน้า user-management)
ระบบต้องมี SUPERADMIN ที่ใช้งานได้อย่างน้อย 1 คนเสมอ (ห้ามถอดสิทธิ์/ระงับคนสุดท้าย)

## Backend (`drrs-api/`)

```
drrs-api/
├── server.js              # entry: express + CORS + rate limiter, ต่อ /api และ /utils
└── src/
    ├── config/            # database (TypeORM DataSource), env (ตรวจ required env vars)
    ├── routes/            # router.js รวม route ย่อย (debtRestructure, pdf, customer, verify, util, register ...)
    ├── middleware/        # authMiddleware.js (บังคับ JWT + ownsAccount กัน IDOR)
    ├── controllers/       # รับ request -> เรียก service (register/ = CBS inquiry controller)
    ├── services/          # business logic — register/ (CBS inquiry + register digitalloan),
    │                      #   condition/ (สร้าง/เก็บไฟล์สัญญา PDF), debtRestructure/, plan/ ฯลฯ
    ├── entities/ model/   # TypeORM entities / data models
    ├── templates/         # HTML template สำหรับหน้า preview-contract-html (loan_condition.template.html)
    └── utils/             # logger (winston), rateLimiter, crypto (AES-GCM), jwt (sign/verify),
                           #   calculateInstallmentSchedule.js (วันที่กำหนดชำระจาก ScheduledNextDate) ฯลฯ
```

- รันด้วย `npm run dev` (nodemon) ใน `drrs-api/`, ฟังพอร์ต `5000`
- endpoint ขึ้นต้น `/api/...` (business) และ `/utils/...` (utility) ผ่าน rate limiter
- endpoint ที่ต้อง login ต้องมี `authMiddleware` (ดูรายละเอียดใน steering `api-and-pdf`)
- **ตารางสัญญา/CBS**: `tbl_contract_file` + `tbl_contract_file_account` (normalize แล้ว — เก็บไฟล์สัญญา
  base64 preview + snapshot ยอดเงิน/ข้อมูล CBS ต่อบัญชี ไว้ reprint ย้อนหลัง)
  แทนที่ `tbl_cbs_inquiry_account` เดิม (เลิกใช้แล้ว ผลลัพธ์ inquiry บันทึกลง `tbl_system_log` แทน)
- `tbl_template_condition` ถูกลบแล้ว (dead code — ไม่มีโค้ดใช้งานจริง)
- `created_by` ของทุกตาราง default เป็น `"DRRS"` (เดิมเป็น `"system"`)

### ฝั่ง Admin (backend)

- **Auth**: `middleware/adminAuthMiddleware.js` (บังคับ admin JWT แยก secret จาก customer, แนบ
  `req.admin = { username, role }`), `middleware/requireAdminRole.js` (ต้อง ADMIN ขึ้นไป),
  `middleware/requireSuperAdminRole.js` (ต้อง SUPERADMIN เท่านั้น — ใช้กับ user-management)
- **Login ผ่าน AD**: `utils/ldapAuth.js` (bind + search ผ่าน `ldapjs`) → `services/admin/adminAuthService.js`
  เทียบ username กับ `tbl_admin_user` แบบ **case-insensitive** (`ILike`) เพราะ AD เองไม่สนตัวพิมพ์
  เล็ก/ใหญ่ตอน bind — ต้องใช้ `ILike` ทุกจุดที่ query username ของตารางนี้ ไม่ใช้ exact match
- **Route/Controller/Service ฝั่ง admin**: `routes/admin*Routes.js` (`adminAuthRoutes`,
  `adminMasterDataRoutes`, `adminTargetDataRoutes`, `adminContractReprintRoutes`,
  `adminUserManageRoutes`) → `controllers/admin/*` → `services/admin/*`
- **ตาราง**: `tbl_admin_user` (whitelist ผู้ใช้ที่มีสิทธิ์ ADMIN/SUPERADMIN เท่านั้น — ผู้ใช้ทั่วไป
  ไม่มีแถวเก็บไว้), `tbl_admin_system_log` (audit log แยกจาก `tbl_system_log` ของลูกค้า)
- **นำเข้าข้อมูล**: ไฟล์ target data (ลูกค้า/บัญชี/แผน) รับเฉพาะ `.csv` (pipe `|` delimited, ไม่มี
  header, encoding auto-detect UTF-8/Windows-874) — ไม่รองรับ `.xlsx` แล้ว (ไฟล์ที่ผ่านการแปลงเป็น
  Excel มาก่อนทำเลขบัตรประชาชนเพี้ยน) ส่วนไฟล์ master data (จังหวัด/อำเภอ/ตำบล) ยังรับทั้ง `.xlsx`/`.csv`
  ดูรายละเอียด parser ที่ `services/admin/targetDataImportService.js` / `masterDataImportService.js`

## กฎการวางไฟล์

- **หน้าใหม่ของ DRRS**: สร้างโฟลเดอร์ใน `pages/LandingPages/<Name>/` ตาม layer
  (`index.js` + `page/controller|services|view`), ทำ wrapper ใน `layouts/pages/landing-pages/<name>/`
  แล้วเพิ่ม `<Route>` ใน `App.js` (ครอบด้วย `<SessionGuard>` ถ้าต้องมี session)
- **เรียก backend**: ผ่านชั้น `src/api/*` เท่านั้น และให้ `page/services/` เป็นตัวเรียก api
  อย่าเรียก axios หรือ api ตรงจาก view/controller
- **helper / validation**: วางใน `src/utils/` และ import แบบ absolute (`utils/...`)
- **การ log**: frontend ใช้ `logger` จาก `utils/logger`; backend ใช้ winston logger — ห้าม `console.log` ตรงๆ
- **หน้าใหม่ของฝั่ง admin**: ทำแบบเดียวกับหน้าลูกค้า แต่ครอบด้วย `<AdminGuard>` (ใส่ `requireAdmin`
  หรือ `requireSuperAdmin` ตามสิทธิ์ที่ต้องการ) ไม่ใช่ `<SessionGuard>`

## การจัดการ Session (สำคัญ)

- `SessionGuard` (`components/SessionGuard/`) ป้องกันทุกหน้าหลัง consent
- `utils/useSessionTimeout.js` — idle timeout + warning dialog (อ่านค่าจาก `appConfig`)
- `utils/useTabLimit.js` — จำกัดจำนวน tab พร้อมกันตาม `MAX_CONNECTIONS`
- `utils/authToken.js` — เก็บ/อ่าน/ล้าง JWT ใน sessionStorage; ล้าง token เมื่อ timeout/ออกจากระบบ/เข้าหน้า consent
- แก้พฤติกรรม timeout/warning ที่ `public/config.js` และ hook ข้างบน อย่า hardcode ตัวเลขในหน้า

## ข้อควรระวังเรื่องเทมเพลต

โปรเจกต์ยังมีไฟล์ตัวอย่างจาก Material Kit 2 (`layouts/sections/`, `examples/`, `routes.js`)
ปนอยู่ ให้แก้เฉพาะส่วน DRRS จริง อย่าไปยุ่งกับไฟล์เทมเพลตที่ไม่ได้ใช้เว้นแต่จำเป็น
