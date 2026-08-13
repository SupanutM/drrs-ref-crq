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
│   ├── public/               # Static assets & web configuration
│   └── src/
│       ├── assets/           # ธีม (Themes), สี (Colors) และรูปภาพ
│       ├── components/       # Reusable UI Components
│       ├── layouts/pages/    # หน้าจอการทำงานหลักของระบบ
│       │   ├── landing-pages/consent/         # หน้าข้อตกลงและความยินยอม
│       │   ├── landing-pages/form-register/   # กรอกข้อมูลยืนยันตัวตน / ตรวจสอบ Laser ID
│       │   ├── landing-pages/loan-plan/       # เลือกแผนปรับโครงสร้างหนี้
│       │   ├── landing-pages/loan-plan-detail/# รายละเอียดและเงื่อนไขแผน
│       │   └── landing-pages/gen-contract/    # สรุปและสร้างเอกสารสัญญา
│       └── routes.js         # ตัวจัดการ Routing
│
└── drrs-api/                 # [Backend] RESTful API Server (Node.js + Express + TypeORM + PostgreSQL)
    ├── server.js             # Entry point ของ API Server
    ├── sql_scripts/          # SQL scripts สำหรับสร้างและอัปเดตโครงสร้างฐานข้อมูล
    └── src/
        ├── config/           # ตั้งค่า Database และ Environment
        ├── controllers/      # Business logic สำหรับ API แต่ละโมดูล
        ├── entities/         # TypeORM Database Models (PostgreSQL Tables)
        ├── routes/           # ตัวจัดการ API Routing (/verify, /debt-restructure, /generate-pdf, /utils)
        ├── services/         # Logic และการเชื่อมต่อกับ External Services (เช่น DOPA API)
        └── utils/            # Utilities (System Logger, Encryption Middleware)
```

---

## 🛠️ Tech Stack

### **Frontend (`drrs`)**
* **Core:** React 18, React Router DOM v6
* **UI & Styling:** Material-UI (MUI v5), Material Kit 2 React Theme, Emotion, ChromaJS
* **Forms & Date Picking:** React Flatpickr, Dayjs, Validator
* **Document Export:** PDFMake

### **Backend (`drrs-api`)**
* **Runtime & Framework:** Node.js v20+, Express.js v5
* **Database & ORM:** PostgreSQL (`pg`), TypeORM
* **Document Generation:** PDFKit, PDFKit-Table
* **Security & Utility:** Crypto (AES Encryption), CORS, Dotenv, Fast XML Parser
* **Logging:** Winston Logger

---

## 🚀 Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (เวอร์ชัน 20.0.0 ขึ้นไป)
* [PostgreSQL](https://www.postgresql.org/) 
* Git

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

---

## 📦 Deployment Guide

> [!WARNING]
> **ข้อควรระวังสำคัญเรื่องไฟล์คอนฟิก (`web.config` และ `server.js`):**  
> **ไฟล์ `web.config` และ `server.js` ในสภาพแวดล้อมการพัฒนา (Development) ไม่สามารถนำไปก๊อปปี้วางทับหรือใช้งานบนเครื่อง Server จริง (Production Server) ได้โดยตรง** เนื่องจากเป็น **คนละสภาพแวดล้อม (Different Environment)** โดยมีการตั้งค่า Path, Routing, Environment Variables (`.env`), การจัดการพอร์ต, และ Policy ของ IIS (`iisnode` / URL Rewrite Module) ที่แตกต่างกันอย่างสิ้นเชิง  
> 👉 *ดังนั้น เวลา Deploy ขึ้น Server จริง จะต้องแยกและใช้ไฟล์คอนฟิกสำหรับ Production ของ Server นั้น ๆ โดยเฉพาะ ห้ามนำ `web.config` หรือ `server.js` จากเครื่อง Dev ไปวางทับไฟล์บน Server เด็ดขาด*

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