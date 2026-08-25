# Tech Stack & Commands

## Stack

- **React 18** (function components + hooks) สร้างด้วย **Create React App** (`react-scripts` 5)
- **Material UI 5** (`@mui/material`, `@mui/icons-material`) + Emotion เป็น styling engine
- ฐานเทมเพลต **Material Kit 2 React** (คอมโพเนนต์ `MK*` เช่น MKBox, MKButton, MKTypography)
- **react-router-dom 6** สำหรับ routing
- **axios** สำหรับเรียก API
- **dayjs** สำหรับจัดการวันที่ (ใช้ helper ใน `utils/day.js`)
- แสดง PDF บนเว็บ: `react-pdf` (การ *สร้าง* PDF ทำที่ backend — ดู steering `api-and-pdf`)
- ความปลอดภัยฝั่ง client: `dompurify` (sanitize ก่อน `dangerouslySetInnerHTML`)
- ตรวจสอบข้อมูล: `validator` + validator เฉพาะทางใน `utils/valid-*.js`
- ภาษา: **JavaScript (.js) เท่านั้น** — ไม่ใช้ TypeScript

### Backend (`drrs-api/`) โดยย่อ

- **Node.js + Express 5**, **TypeORM + PostgreSQL** (`pg`)
- Auth: **jsonwebtoken** (session token), `express-rate-limit`, logger = **winston**
- สร้าง PDF: `puppeteer` (render HTML template) + `pdf-lib`/`pdfkit`, ส่งเมลด้วย `nodemailer`
- รัน `npm run dev` (nodemon) ในโฟลเดอร์ `drrs-api/` พอร์ต 5000

## คำสั่งที่ใช้บ่อย (รันในโฟลเดอร์ `drrs/`)

- `npm install` — ติดตั้ง dependencies
- `npm run dev` — เปิด dev server (`react-scripts start`)
- `npm run build` — build production (ตั้ง `HTTPS=true`)
- `npm run lint` — ESLint ที่ `./src`
- `npm run prettify` — จัด format ด้วย Prettier

หมายเหตุ: dev server เป็น process ค้างยาว ให้ผู้ใช้รันเองในเทอร์มินัล อย่ารันผ่านคำสั่งอัตโนมัติ

## Config & Environment

- ค่า backend อยู่ใน `.env`: `REACT_APP_BACKEND_URL` (ตั้ง base URL ของ API)
- `REACT_ENV=development` เปิด log; ถ้าไม่ใช่ development `logger` จะไม่พิมพ์ออก console
- ค่า runtime ฝั่ง client อยู่ใน `public/config.js` (`window.APP_CONFIG`): `SESSION_TIMEOUT`,
  `SESSION_WARNING`, `MAX_CONNECTIONS` อ่านผ่าน `utils/appConfig.js`
- `config-overrides.js` กำหนด webpack polyfill สำหรับ node core modules (crypto, stream ฯลฯ)

## Code Style

- Prettier: `printWidth 100`, `tabWidth 2`, มี semicolon, ใช้ double quote, `trailingComma: es5`
- **Absolute import จาก `src`** (เช่น `import { logger } from "utils/logger"`) ตั้งค่าไว้ใน
  jsconfig และ eslint import resolver — ห้ามใช้ relative path ยาวๆ เช่น `../../../utils`
- ตั้งชื่อไฟล์คอมโพเนนต์และหน้าเป็น PascalCase, ฟังก์ชัน/ตัวแปรเป็น camelCase
