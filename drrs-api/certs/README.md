# certs

วางไฟล์ใบรับรอง (cert) ของระบบภายนอกที่นี่ — **ห้าม commit ไฟล์ cert/key จริง**
(`.gitignore` กัน `*.pem *.crt *.cer *.key *.p12 *.pfx` ไว้แล้ว)

## CUST360 (CUST Profile API)

CA cert สำหรับยืนยันว่า server CUST360 เป็นตัวจริง (กัน MITM) ใช้ร่วมกันทั้ง 2 จุด
ที่เรียก CUST360 (`customerLookupService.js`, `customerController.js`) ผ่าน
`src/utils/custHttpsAgent.js`

**ต้องตั้ง env นี้เสมอ ไม่มี default path ในโค้ด:**
```
CUST_CA_CERT_PATH=./certs/<ชื่อไฟล์จริง>.pem
```

ตัวอย่างไฟล์จริงที่ใช้กับ UAT: `custprofileuat.gsb.or.th_enkey.pem`

**ถ้าไม่ตั้ง env หรือตั้งแล้วหาไฟล์ไม่เจอ/อ่านไม่ได้ → backend เรียก CUST360 ไม่ได้
เลย (throw error ทันที ทุก environment)** ไม่มีโหมด fallback ไม่ตรวจใบรับรองอีกแล้ว
ต้องแก้ `.env` ให้ path ถูกก่อนถึงจะใช้งานได้

ตรวจว่าโหลด cert สำเร็จ: จะเห็น log ตอนเรียก CUST360 ครั้งแรก
```
[CUST360] โหลด CA cert แล้ว (...) — เปิดตรวจสอบใบรับรอง server
```

**หมายเหตุเรื่อง cert rotation:** โหลดสำเร็จแล้ว agent จะถูก cache ไว้ตลอดอายุ
process — เปลี่ยน/หมุน cert ใหม่ต้อง **restart backend** ถึงจะอ่านไฟล์ใหม่
