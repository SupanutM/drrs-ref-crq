// Test data สำหรับ E2E tests
// ค่าใน validIndividual ถูกตรวจกับ validator ตัวจริงของโปรเจกต์แล้ว (utils/valid-*.js)
// - citizenId ผ่าน validator.isIdentityCard(value, "TH") (checksum ถูกต้อง)
// - telNo ผ่าน validator.isMobilePhone(value, "th-TH")
// - laserCardId ตรง /^[A-Z]{2}\d{10}$/
// หมายเหตุ: utils/valid-*.js คืนค่า true = "ไม่ถูกต้อง" (ใช้เป็น error flag)

const validIndividual = {
  citizenId: "1101201567898", // checksum ถูกต้อง
  laserCardId: "ME1234567890",
  name: "ทดสอบ",
  surname: "ระบบ",
  telNo: "0812345678",
  email: "test@example.com",
  digitNo: "1234",
  // วันเกิดแบบครบถ้วน (birthDateType = "1") -> dateOfBirth = "2530-01-15"
  birthDate: { beYear: "2530", month: "มกราคม", day: "15" },
};

/**
 * ข้อมูลที่ไม่ถูกต้อง (สำหรับ test validation)
 */
const invalidData = {
  citizenIdShort: "12345", // ไม่ครบ 13 หลัก
  citizenIdBadChecksum: "1101201567890", // ครบ 13 หลัก แต่ checksum ผิด
  laserCardIdBadFormat: "1234567890AB", // ตัวเลขนำ ผิดรูปแบบ
  laserCardIdShort: "ME123",
  nameSpecialChar: "ทดสอบ123",
  surnameSpecialChar: "ระบบ!!",
  telNoShort: "081234567", // 9 หลัก
  emailInvalid: "not-an-email",
  digitNoShort: "12",
};

/**
 * Label ของ input ในฟอร์มบุคคลธรรมดา (ตรงกับ IndividualFormView.js)
 */
const formLabels = {
  citizenId: "ระบุเลขบัตรประชาชน 13 หลัก",
  laserCardId: "ระบุเลขหลังบัตรประชาชน",
  name: "ระบุชื่อ",
  surname: "ระบุนามสกุล",
  telNo: "ระบุเบอร์โทรติดต่อ",
  email: "ระบุอีเมล (สำหรับการจัดส่งสำเนาสัญญาอิเล็กทรอนิกส์)",
  digitNo: "ระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร",
  birthDateFull: "ระบุ วัน/เดือน/ปี (พ.ศ.) เกิด",
  birthDateYear: "ระบุ ปี (พ.ศ.) เกิด",
};

/**
 * ข้อความ error ที่แสดงใต้ input (ตรงกับ IndividualFormView.js)
 */
const formErrors = {
  citizenId: "กรุณาระบุเลขบัตรประชาชนให้ถูกต้อง หรือครบถ้วน",
  laserCardId:
    "กรุณาระบุเลขหลังบัตรประชาชนให้ถูกต้อง (2 ตัวอักษรภาษาอังกฤษ ตามด้วยตัวเลข 10 ตัว)",
  name: "กรุณาระบุชื่อให้ถูกต้อง",
  surname: "กรุณาระบุนามสกุลให้ถูกต้อง",
  telNo: "กรุณาระบุเบอร์โทรติดต่อให้ถูกต้อง หรือครบถ้วน (10 หลัก)",
  email: "กรุณาระบุอีเมลให้ถูกต้อง (เช่น example@domain.com)",
  digitNo: "กรุณาระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร ให้ถูกต้อง",
  incomplete: "กรุณาระบุและตรวจสอบรูปแบบข้อมูลให้ถูกต้องครบถ้วน",
};

/**
 * Router state สำหรับจำลองการเข้าหน้าที่ต้องมี state
 */
const mockRouterState = {
  consentFlag: true,
  targetInfo: {
    cusTargetId: "CUS001",
    citizenId: "1101201567898",
    name: "ทดสอบ",
    surname: "ระบบ",
    dateOfBirth: "2530-01-15",
    accountNo: "ACC001",
    netIncome: 20000,
    totalIncome: 30000,
    otherIncome: 0,
    totalCost: 10000,
    accounts: [
      {
        accountNo: "ACC001",
        outstanding: 50000,
        loanAmount: 100000,
        minAmount: 5000,
        isRegistered: false,
        masterPlan: [
          {
            planNo: "PLAN01",
            planName: "แผนปรับโครงสร้างหนี้ A",
            loanType: "LT",
            isCheckIncome: "1",
            details: [
              {
                principal: 100000,
                interest: 3,
                installmentAmount: 5000,
                installmentTerms: 24,
                installmentFrequency: 30,
                paymentAmount: 5000,
                startDate: "2569-09-01",
                endDate: "2571-08-01",
              },
            ],
          },
          {
            planNo: "PLAN02",
            planName: "แผนตัดหนี้ B (Haircut)",
            loanType: "HC",
            isCheckIncome: "0",
            details: [{ amount: 30000, paymentAmount: 30000, desc: "HC" }],
          },
        ],
      },
    ],
    masterPlan: [
      { planNo: "PLAN01", planName: "แผนปรับโครงสร้างหนี้ A", loanType: "LT" },
      { planNo: "PLAN02", planName: "แผนตัดหนี้ B (Haircut)", loanType: "HC" },
    ],
    masterPlanDetail: [],
    oldInstallments: [],
  },
};

module.exports = {
  validIndividual,
  invalidData,
  formLabels,
  formErrors,
  mockRouterState,
};
