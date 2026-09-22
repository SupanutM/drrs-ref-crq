# 💡 Digital-Loan (DRRS)

[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![MUI](https://img.shields.io/badge/UI%20Framework-MUI%20v5-007FFF?logo=mui&logoColor=white)](https://mui.com/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%2020%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/API-Express%20v5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeORM](https://img.shields.io/badge/ORM-TypeORM-FE0902?logo=typeorm&logoColor=white)](https://typeorm.io/)



## 📂 โครงสร้างโปรเจกต์

```text
Digital-Loan/
│
├── drrs/                     # [Frontend] Web Application (React 18 + Material Kit 2 MUI)
│   ├── public/
│   │   └── config.js         # Runtime config -> window.APP_CONFIG (แก้บน server ได้ ไม่ต้อง build ใหม่)
│   └── src/
│       ├── api/              # ชั้นเรียก Backend ด้วย axios (handler, register, verify, master, admin ...)
│       ├── assets/           # ธีม (Themes), สี (Colors), ฟอนต์ไทย และรูปภาพ
│       ├── components/       # Reusable UI Components (MK*, SessionGuard, AdminGuard, AdminNavbar ...)
│       ├── examples/         # คอมโพเนนต์จากเทมเพลต Material Kit (Navbars, Cards, Footer)
│       ├── layouts/pages/landing-pages/   # Wrapper บาง ๆ ต่อ 1 route -> เรียกหน้าจริงใน pages/
│       ├── pages/LandingPages/            # ★ หน้าจริงของระบบ (โค้ดหลักอยู่ที่นี่)
│       │   ├── Consent/            # หน้าข้อตกลงและความยินยอม (จุดเริ่ม session)
│       │   ├── FormRegister/       # กรอกข้อมูลยืนยันตัวตน / ตรวจสอบ Laser ID
│       │   ├── LoanPlan/           # ข้อมูลสินเชื่อ
│       │   ├── LoanPlanDetails/    # รายละเอียดและเงื่อนไขแผน
│       │   ├── SelectPlan/         # เลือกแผนปรับโครงสร้างหนี้
│       │   ├── PlanPreview/        # ดูตัวอย่างแผนก่อนยืนยัน
│       │   ├── PlanSummary/        # สรุปแผนที่เลือก
│       │   ├── GenContract/        # สร้างและดูเอกสารสัญญา (PDF)
│       │   └── Admin*/             # ฝั่งเจ้าหน้าที่ (Login, MasterImport, TargetImport,
│       │                           #   ContractReprint, UserManage)
│       ├── utils/            # Helper: logger, validators, session, day.js, authToken, adminAuthToken
│       └── App.js            # ★ ประกาศ Routes ทั้งหมดของระบบ
│
└── drrs-api/                 # [Backend] RESTful API Server (Node.js + Express + TypeORM + PostgreSQL)
    ├── server.js             # Entry point: Express + CORS + Rate Limiter -> /api และ /utils
    ├── sql/                  # SQL scripts สำหรับสร้างและอัปเดตโครงสร้างฐานข้อมูล
    ├── certs/                # ใบรับรอง (CA cert) สำหรับเรียก External API
    ├── assets/contracts/     # ไฟล์สัญญา PDF ที่ระบบสร้างขึ้น
    ├── logs/                 # Winston log (daily rotate)
    └── src/
        ├── config/           # ตั้งค่า Database (TypeORM DataSource) และตรวจ Environment
        ├── controllers/      # รับ Request -> เรียก Service
        ├── entities/ model/  # TypeORM Entities / Data Models (PostgreSQL Tables)
        ├── middleware/       # authMiddleware (JWT + กัน IDOR), adminAuthMiddleware, requireAdminRole
        ├── routes/           # API Routing — router.js รวม route ย่อยทั้งหมด
        ├── services/         # Business logic + เชื่อมต่อ External Services (DOPA, CBS, AD)
        ├── templates/        # HTML template สำหรับหน้า preview สัญญา (EJS)
        └── utils/            # Logger (Winston), Rate Limiter, Crypto (AES), JWT, คำนวณงวดผ่อน
```

> [!NOTE]
> **สถาปัตยกรรมของแต่ละหน้า (Frontend)** — 1 หน้ามี 3 ชั้น:
> 1. **Route** ใน `src/App.js` → ชี้ไปที่ Wrapper
> 2. **Wrapper** ใน `layouts/pages/landing-pages/<name>/` → import หน้าจริงมา render
> 3. **หน้าจริง** ใน `pages/LandingPages/<Name>/` แยกเป็น `index.js` (layout) +
>    `page/controller/` (state & logic) + `page/services/` (เรียก `api/*`) + `page/view/` (แสดงผล)

---

## 🛠️ Tech Stack

### **Frontend (`drrs`)**
* **Core:** React 18 (Function Components + Hooks), React Router DOM v6, Create React App (`react-scripts` 5)
* **UI & Styling:** Material-UI (MUI v5), Material Kit 2 React Theme, Emotion, ChromaJS
* **API Client:** Axios (ผ่านชั้น `src/api/*` เท่านั้น — ไม่เรียก axios ตรงจาก View/Controller)
* **Forms & Date Picking:** React Flatpickr, React Datepicker, Dayjs, Validator
* **Document Viewing:** React-PDF *(การ **สร้าง** PDF ทำที่ Backend ทั้งหมด)*
* **Client Security:** DOMPurify (sanitize ก่อน `dangerouslySetInnerHTML`)
* **ภาษา:** JavaScript (`.js`) เท่านั้น — ไม่ใช้ TypeScript

### **Backend (`drrs-api`)**
* **Runtime & Framework:** Node.js v20+, Express.js v5
* **Database & ORM:** PostgreSQL (`pg`), TypeORM
* **Authentication:** JSON Web Token (`jsonwebtoken`) — แยก secret ระหว่างลูกค้ากับ Admin
* **Admin Directory Auth:** LDAP.js (bind / search Active Directory)
* **Document Generation:** PDFKit, PDFKit-Table, PDF-Lib (รวมหน้า / ใส่รหัสป้องกันไฟล์), EJS (หน้า preview)
* **File Import:** Multer (รับไฟล์อัปโหลด), ExcelJS (`.xlsx`), Iconv-Lite (แปลง encoding Windows-874/UTF-8)
* **Email:** Nodemailer
* **Security & Utility:** Crypto (AES-GCM), CORS, Express Rate Limit, Dotenv, Fast XML Parser
* **Logging:** Winston Logger (Daily Rotate File)

---

## 🧭 Routes & Flow

> ประกาศทั้งหมดอยู่ใน `drrs/src/App.js`

### 👤 ฝั่งลูกค้า (ประชาชน)

ทุกหน้า **หลังจาก** `consent` ถูกครอบด้วย `<SessionGuard>` (ต้องมี session ที่ถูกต้อง)

| ลำดับ | Route | หน้า | Guard |
|---|---|---|---|
| — | `/` | Redirect ไป `/drrs/consent` | — |
| 1 | `/drrs/consent` | ข้อตกลงและความยินยอม (เปิด session) | ไม่มี |
| 2 | `/drrs/form` | กรอกข้อมูล / ตรวจสอบ Laser ID | `SessionGuard` |
| 3 | `/drrs/plan` | ข้อมูลสินเชื่อ | `SessionGuard` |
| 4 | `/drrs/plan-detail` | รายละเอียดและเงื่อนไขแผน | `SessionGuard` |
| 5 | `/drrs/select-plan` | เลือกแผนปรับโครงสร้างหนี้ | `SessionGuard` |
| 6 | `/drrs/plan-preview` | ดูตัวอย่างแผนก่อนยืนยัน | `SessionGuard` |
| 7 | `/drrs/plan-summary` | สรุปแผนที่เลือก | `SessionGuard` |
| 8 | `/drrs/contract` | สร้าง / ดูเอกสารสัญญา (PDF) | `SessionGuard` |

### 🏦 ฝั่งเจ้าหน้าที่ (Admin)

ยืนยันตัวตนผ่าน **Active Directory (AD)** ขององค์กร — ไม่มีการเก็บ password ไว้ในระบบ

| Route | หน้า | สิทธิ์ที่ต้องมี |
|---|---|---|
| `/drrs/admin` | ทางเข้า (มี token → ไปหน้า reprint / ไม่มี → ไปหน้า login) | — |
| `/drrs/admin/login` | เข้าสู่ระบบด้วยบัญชี AD | ไม่มี |
| `/drrs/admin/contract-reprint` | พิมพ์สัญญาย้อนหลัง **(หน้าแรกหลัง login เสมอ)** | ทุก role |
| `/drrs/admin/master-import` | นำเข้าข้อมูล Master (จังหวัด/อำเภอ/ตำบล) | `ADMIN` ขึ้นไป |
| `/drrs/admin/target-import` | นำเข้าข้อมูล Target (ลูกค้า/บัญชี/แผน) | `ADMIN` ขึ้นไป |
| `/drrs/admin/user-management` | จัดการสิทธิ์ผู้ใช้ Admin | `SUPERADMIN` เท่านั้น |

**สิทธิ์แบบลำดับชั้น** (เก็บใน `tbl_admin_user.role`):

| Role | ทำอะไรได้ |
|---|---|
| `NULL` (ผู้ใช้ทั่วไป) | พิมพ์สัญญาย้อนหลังได้อย่างเดียว *(ไม่มีแถวเก็บไว้ในตาราง)* |
| `ADMIN` | + นำเข้าข้อมูล Master / Target |
| `SUPERADMIN` | + จัดการสิทธิ์ผู้ใช้ Admin คนอื่น |

> [!IMPORTANT]
> ระบบต้องมี `SUPERADMIN` ที่ใช้งานได้ **อย่างน้อย 1 คนเสมอ** (ห้ามถอดสิทธิ์/ระงับคนสุดท้าย)
> การตั้ง `SUPERADMIN` คนแรกทำผ่าน SQL โดยตรง

### 🔐 การจัดการ Session

* `SessionGuard` ป้องกันทุกหน้าหลัง consent, `AdminGuard` ป้องกันทุกหน้า admin (ยกเว้น login)
* Token ของลูกค้าและ admin เก็บใน `sessionStorage` **คนละ key เด็ดขาด**
  (`utils/authToken.js` กับ `utils/adminAuthToken.js`)
* Idle timeout / คำเตือน / จำนวน tab ปรับได้ที่ `drrs/public/config.js`
  (`SESSION_TIMEOUT`, `SESSION_WARNING`, `MAX_CONNECTIONS`) — **อย่า hardcode ตัวเลขในหน้าเว็บ**
* หลัง verify สำเร็จ Backend จะออก **session token (JWT)** ผูกกับตัวลูกค้า —
  ทุก endpoint ที่แตะข้อมูลลูกค้าต้องดึงตัวตนจาก token เท่านั้น **ห้ามเชื่อ id ที่ client ส่งมา** (กัน IDOR)

---

## 🚀 Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (เวอร์ชัน 20.0.0 ขึ้นไป)
* [PostgreSQL](https://www.postgresql.org/) 
* Git

---

### 1.1 ตั้งค่า Config ก่อนรันครั้งแรก ⚠️

> [!WARNING]
> ไฟล์ `drrs-api/.env` และ `drrs/public/config.js` ถูกกันไว้ใน `.gitignore`
> **คนที่ clone repo มาใหม่จะไม่มี 2 ไฟล์นี้** ต้องสร้างเองก่อน ไม่งั้นระบบจะรันไม่ขึ้น
> (ขอไฟล์ตัวอย่างจากคนในทีม)

1. **`drrs-api/.env`** — ตั้งค่าเชื่อมฐานข้อมูล, External API, Secret ต่าง ๆ
   ดูรายการตัวแปรที่จำเป็นได้จาก `drrs-api/src/config/env.js`

2. **`drrs/public/config.js`** — Runtime config ของฝั่งเว็บ:
   ```js
   window.APP_CONFIG = {
     BACKEND_URL: "http://localhost:5000", // ตอนรันในเครื่อง (Production ใช้ "/drrs/reverse")
     SESSION_TIMEOUT: 900,                 // วินาที — idle timeout
     SESSION_WARNING: 15,                  // วินาที — เตือนก่อนหมดเวลา
     MAX_CONNECTIONS: 5,                   // จำนวน tab ที่เปิดพร้อมกันได้
   };
   ```
   > **ถ้าขึ้น `Cannot POST /drrs/reverse/api/...` ตอนรันในเครื่อง** สาเหตุคือ `BACKEND_URL`
   > ยังเป็นค่าของ Production (`/drrs/reverse`) ซึ่งต้องมี IIS ช่วย rewrite —
   > ตอนรันในเครื่องให้เปลี่ยนเป็น `http://localhost:5000`

---

### 2. Backend (`drrs-api`)

1. เข้าไปยังโฟลเดอร์ Backend:
   ```bash
   cd drrs-api
   ```
2. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
3. สั่งรัน API Server (Development Mode):
   ```bash
   npm run dev
   ```
   > Server จะเริ่มต้นทำงานที่พอร์ต `5000` (หรือพอร์ตที่กำหนดใน `.env`) และเชื่อมต่อฐานข้อมูล PostgreSQL ผ่าน TypeORM

---

### 3. Frontend (`drrs`)

1. เข้าไปยังโฟลเดอร์ Frontend:
   ```bash
   cd ../drrs
   ```
2. ติดตั้ง Dependencies:
   ```bash
   npm install
   # หรือ yarn install
   ```
3. สั่งรัน Web Application:
   ```bash
   npm run dev
   ```
   > Web Application จะเปิดทำงานที่ `http://localhost:3000` โดยจะ Redirection ไปที่ `/drrs/consent` เป็นหน้าแรก
   > (ทางเข้าฝั่งเจ้าหน้าที่คือ `http://localhost:3000/drrs/admin`)

> [!NOTE]
> CORS ฝั่ง Backend อนุญาตเฉพาะ origin ที่กำหนดไว้ใน `drrs-api/server.js` (`allowedOrigins`)
> ตอนรันในเครื่องค่าเริ่มต้นคือ `http://localhost:3000`

---

### 4. คำสั่งที่ใช้บ่อย

**ในโฟลเดอร์ `drrs/` (Frontend)**

| คำสั่ง | ทำอะไร |
|---|---|
| `npm install` | ติดตั้ง dependencies |
| `npm run dev` | เปิด Dev Server (`react-scripts start`) |
| `npm run build` | Build Production (ตั้ง `HTTPS=true`) |
| `npm run lint` | ตรวจ ESLint ที่ `./src` |
| `npm run prettify` | จัด Format ด้วย Prettier |

**ในโฟลเดอร์ `drrs-api/` (Backend)**

| คำสั่ง | ทำอะไร |
|---|---|
| `npm install` | ติดตั้ง dependencies |
| `npm run dev` | รัน API Server ด้วย `nodemon` (พอร์ต `5000`) |

**Code Style:** Prettier — `printWidth 100`, `tabWidth 2`, ใส่ semicolon, ใช้ double quote
ฝั่ง Frontend ใช้ **Absolute import จาก `src`** (เช่น `import { logger } from "utils/logger"`)
ห้ามใช้ relative path ยาว ๆ เช่น `../../../utils`

---

## 📦 Deployment Guide

> [!WARNING]
> **ข้อควรระวังสำคัญเรื่องไฟล์คอนฟิก (`web.config` และ `server.js`):**  
> **ไฟล์ `web.config` และ `server.js` ในสภาพแวดล้อมการพัฒนา (Development) ไม่สามารถนำไปก๊อปปี้วางทับหรือใช้งานบนเครื่อง Server จริง (Production Server) ได้โดยตรง** เนื่องจากเป็น **คนละสภาพแวดล้อม (Different Environment)** โดยมีการตั้งค่า Path, Routing, Environment Variables (`.env`), การจัดการพอร์ต, และ Policy ของ IIS (`iisnode` / URL Rewrite Module) ที่แตกต่างกันอย่างสิ้นเชิง  
> 👉 *ดังนั้น เวลา Deploy ขึ้น Server จริง จะต้องแยกและใช้ไฟล์คอนฟิกสำหรับ Production ของ Server นั้น ๆ โดยเฉพาะ ห้ามนำ `web.config` หรือ `server.js` จากเครื่อง Dev ไปวางทับไฟล์บน Server เด็ดขาด*

### ✅ 0. Pre-Deploy Checklist (ตรวจก่อน Deploy ทุกครั้ง)

> [!CAUTION]
> ค่าเหล่านี้ตั้งไว้สำหรับ **รันในเครื่อง (Development)** ถ้าลืมเปลี่ยนก่อนขึ้น Production
> ระบบจะเปิดช่องให้เข้าถึงได้โดยไม่ต้องยืนยันตัวตน

| ไฟล์ | ตัวแปร | ค่าตอน Dev | ✅ ค่าที่ต้องเป็นบน Production |
|---|---|---|---|
| `drrs/public/config.js` | `BACKEND_URL` | `http://localhost:5000` | `/drrs/reverse` (ให้ `web.config` rewrite ส่งต่อให้) |
| `drrs-api/.env` | `ADMIN_LOGIN_BYPASS` | `true` | **`false`** (หรือลบบรรทัดทิ้ง) |
| `drrs-api/.env` | `LOAD_TEST_MODE` | `false` | **`false`** (หรือลบบรรทัดทิ้ง) |
| `drrs-api/.env` | `NODE_ENV` | `development` | ตามสภาพแวดล้อมจริง (เช่น `UAT` / `production`) |

**ผลกระทบถ้าลืมเปลี่ยน:**

* `ADMIN_LOGIN_BYPASS=true` → **ใครก็ login เข้าหน้า Admin ได้ โดยไม่เช็ก password กับ AD เลย** (ใส่ username อะไรก็ผ่าน)
* `LOAD_TEST_MODE=true` → ข้ามการตรวจสอบตัวตนกับ DOPA API
* `BACKEND_URL` ผิด → หน้าเว็บเรียก API ไม่ได้ ขึ้น `Cannot POST /...`

---

### 🔑 0.1 การหมุน Secret ก่อนขึ้น Production

> [!IMPORTANT]
> `JWT_SECRET` (ลูกค้า) และ `JWT_ADMIN_SECRET` (admin) **ต้องเป็นค่าที่ไม่ซ้ำกันเด็ดขาด**
> ถ้าซ้ำกัน token ของลูกค้ากับ admin จะ verify ผ่านข้างกันได้
> หมายเหตุ: `src/config/env.js` จะ **fallback ไปใช้ `JWT_SECRET`** ถ้าไม่ได้ตั้ง `JWT_ADMIN_SECRET`
> ดังนั้นต้องตั้งค่าให้ชัดเจน ห้ามปล่อยว่าง

สร้างค่าใหม่ (รันในโฟลเดอร์ `drrs-api/`) — รัน **2 ครั้ง** เอาไปใส่คนละตัวแปร:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

ตัวแปรที่ต้องหมุนใหม่บน Production (ห้ามใช้ค่าเดียวกับเครื่อง Dev):

* `JWT_SECRET` / `JWT_ADMIN_SECRET`
* `CRYPTO_KEY` / `CRYPTO_IV`
* `PDF_OWNER_PASSWORD`
* `DB_PASS`

> [!WARNING]
> ไฟล์ `.env` ถูกกันไว้ใน `.gitignore` แล้ว (**ห้าม commit เด็ดขาด**)
> ถ้าเคย commit ขึ้นไปก่อนหน้านี้ ให้ถือว่า secret ทุกตัวในไฟล์นั้น **รั่วแล้ว** และต้องหมุนใหม่ทั้งหมด

---

### 🌐 1. Deploy Frontend (`drrs`)

1. เข้าไปยังโฟลเดอร์ `drrs` และทำการ Build Production Bundle:
   ```bash
   cd drrs
   npm run build
   ```
2. เมื่อ Build สำเร็จ จะได้โฟลเดอร์ `build/`
3. **การนำไปวางบน IIS / Web Server:**
   - คัดลอกไฟล์ทั้งหมดภายในโฟลเดอร์ `build/` ไปวางที่ Physical Path ของเว็บไซต์บน IIS Server (เช่น `C:\inetpub\wwwroot\drrs`)
   - ตรวจสอบให้แน่ใจว่าไฟล์ `web.config` ฝั่ง Production ถูกตั้งค่าและคัดลอกไปด้วย เพื่อให้ระบบทำการ Rewrite Routes ของ React Single Page Application (`index.html`) ได้อย่างถูกต้องเมื่อ Refresh หน้าเว็บ

---

### 🖥️ 2. Deploy Backend API (`drrs-api`) บน Microsoft IIS (ผ่าน `iisnode`)

> [!NOTE]
> **เนื่องจาก Server จริงไม่อนุญาตให้ติดตั้งหรือรันคำสั่ง `npm` (Offline / No Build on Server):**  
> เราจะทำการเตรียมแพ็กเกจล่วงหน้าผ่านสคริปต์ `.sh` หรือจากเครื่องเตรียมระบบ (Prep/Build Machine) ให้เสร็จเรียบร้อยก่อน แล้วจึงคัดลอกไฟล์ทั้งหมดขึ้นไปวางบน Server ทันที

1. **เตรียมแพ็กเกจล่วงหน้าจากเครื่อง Prep/Build (ผ่านสคริปต์ `.sh` หรือ Command Line):**  
   เข้าไปยังโฟลเดอร์ `drrs-api` บนเครื่องเตรียมระบบ และสั่งติดตั้งเฉพาะ Production Dependencies:
   ```bash
   cd drrs-api
   npm install --omit=dev
   ```
2. **เตรียมไฟล์คอนฟิกสำหรับ Server จริง:**  
   ตรวจสอบและเปลี่ยนไฟล์ `web.config` และ `server.js` ให้เป็นคอนฟิกสำหรับ Production (ห้ามใช้ไฟล์จากเครื่อง Dev) พร้อมสร้างไฟล์ `.env` ของ Server จริงเตรียมไว้
3. **นำขึ้นวางบน IIS Server:**  
   คัดลอกโฟลเดอร์ `drrs-api` **ทั้งหมด (รวมโฟลเดอร์ `node_modules` ที่ติดตั้งเรียบร้อยแล้วในข้อ 1)** ไปวางที่ Physical Path บน Server (เช่น `C:\inetpub\wwwroot\drrs-api`) **โดยไม่ต้องรันคำสั่ง `npm install` ใด ๆ บน Server อีก**
4. **ตั้งค่าสิทธิ์และการทำงานบน IIS:**  
   - ติดตั้ง **[iisnode](https://github.com/Azure/iisnode)** และ **URL Rewrite Module** บน IIS Server
   - ตั้งค่า Application Pool ใน IIS ให้สิทธิ์การอ่าน/เขียน (Read/Write Permissions) สำหรับโฟลเดอร์ `logs/` เพื่อให้ `Winston` สามารถบันทึก Log ได้
   - ไฟล์ `web.config` ฝั่ง Production จะทำการส่งต่อ Request (`/*`) ไปยัง `server.js` ผ่าน `iisnode` โดยอัตโนมัติ

---

## 📝 License & Author
© Digital-Loan (DRRS) System. All Rights Reserved.