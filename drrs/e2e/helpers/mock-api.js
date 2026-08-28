// Helper: mock API responses for Playwright tests
// ใช้ route interception เพื่อจำลอง backend responses

/**
 * แทนค่า runtime config (public/config.js) เพื่อย่นเวลา session timeout
 * และปรับจำนวน tab สูงสุดในการทดสอบ
 *
 * ต้อง intercept ไฟล์ config.js เพราะ index.html โหลดเป็น <script> แยก
 * (ถ้าใช้ addInitScript ค่าจะถูก config.js ตัวจริงเขียนทับ)
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ sessionTimeout?: number, sessionWarning?: number, maxConnections?: number }} cfg
 */
async function mockAppConfig(page, cfg = {}) {
  const {
    sessionTimeout = 120,
    sessionWarning = 15,
    maxConnections = 5,
  } = cfg;

  await page.route("**/config.js", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.APP_CONFIG = {
        SESSION_TIMEOUT: ${sessionTimeout},
        SESSION_WARNING: ${sessionWarning},
        MAX_CONNECTIONS: ${maxConnections},
      };`,
    });
  });
}

/**
 * Mock ให้ระบบเปิดอยู่ (status_flag = true)
 */
async function mockSystemOpen(page) {
  await page.route("**/api/checkCloseSystem", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: true,
        data: [{ status_flag: true, appVersion: "1.0.0" }],
      }),
    });
  });
}

/**
 * Mock ให้ระบบปิด (status_flag = false)
 */
async function mockSystemClosed(page) {
  await page.route("**/api/checkCloseSystem", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: true,
        data: [{ status_flag: false, appVersion: "1.0.0" }],
      }),
    });
  });
}

/**
 * Mock verify-register สำเร็จ (ส่ง token + targetInfo กลับมา)
 */
async function mockVerifySuccess(page) {
  await page.route("**/api/verify-register", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ตรวจสอบสำเร็จ",
        data: {
          token: "mock-jwt-token-for-testing",
          targetInfo: {
            cusTargetId: "CUS001",
            citizenId: "1234567890123",
            name: "ทดสอบ",
            surname: "ระบบ",
            dateOfBirth: "2530-01-15",
            accountNo: "ACC001",
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
                    details: [
                      {
                        amount: 30000,
                        paymentAmount: 30000,
                        desc: "HC",
                      },
                    ],
                  },
                ],
              },
            ],
            masterPlan: [
              { planNo: "PLAN01", planName: "แผนปรับโครงสร้างหนี้ A", loanType: "LT" },
              { planNo: "PLAN02", planName: "แผนตัดหนี้ B (Haircut)", loanType: "HC" },
            ],
            masterPlanDetail: [],
            totalIncome: 30000,
            otherIncome: 0,
            totalCost: 10000,
            netIncome: 20000,
            oldInstallments: [],
          },
        },
      }),
    });
  });
}

/**
 * Mock verify-register ล้มเหลว (ข้อมูลไม่ถูกต้อง)
 */
async function mockVerifyFail(page) {
  await page.route("**/api/verify-register", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
      }),
    });
  });
}

/**
 * Mock verify-register - server error
 */
async function mockVerifyServerError(page) {
  await page.route("**/api/verify-register", (route) => {
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "Internal Server Error" }),
    });
  });
}

/**
 * Mock check-plan สำเร็จ
 */
async function mockCheckPlanSuccess(page) {
  await page.route("**/api/check-plan", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });
}

/**
 * Mock check-plan ล้มเหลว
 */
async function mockCheckPlanFail(page) {
  await page.route("**/api/check-plan", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: false, message: "ไม่สามารถเลือกแผนนี้ได้" }),
    });
  });
}

/**
 * Mock debt-restructure (save) สำเร็จ
 */
async function mockSaveDebtSuccess(page) {
  await page.route("**/api/debt-restructure", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        template: {
          conditionMonth: "กันยายน",
          conditionYear: "2569",
          items: [{ desc: "แผนปรับโครงสร้างหนี้", qty: 1, price: "5,000 บาท/เดือน" }],
        },
      }),
    });
  });
}

/**
 * Mock debt-restructure (save) ล้มเหลว
 */
async function mockSaveDebtFail(page) {
  await page.route("**/api/debt-restructure", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      }),
    });
  });
}

/**
 * Mock cancel-plan สำเร็จ
 */
async function mockCancelPlanSuccess(page) {
  await page.route("**/api/cancel-plan", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

/**
 * Mock generate-pdf สำเร็จ (base64 PDF เล็กๆ)
 */
async function mockGeneratePdfSuccess(page) {
  await page.route("**/api/generate-pdf", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        base64: "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
        fileName: "contract_test.pdf",
      }),
    });
  });
}

/**
 * Mock generate-pdf ล้มเหลว
 */
async function mockGeneratePdfFail(page) {
  await page.route("**/api/generate-pdf", (route) => {
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "ไม่สามารถสร้างเอกสาร PDF ได้" }),
    });
  });
}

/**
 * Mock preview-contract-html สำเร็จ
 */
async function mockContractHtmlSuccess(page) {
  await page.route("**/api/preview-contract-html", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        "<div><h3>สัญญาปรับโครงสร้างหนี้</h3><p>รายละเอียดสัญญา...</p></div>"
      ),
    });
  });
}

/**
 * Mock generate-contract สำเร็จ
 *
 * backend เปลี่ยนจากส่ง blob เป็น base64 JSON ({ success, base64, fileName })
 * (เปลี่ยนมาใช้ pdfkit แทน puppeteer) — mock จึงตอบ base64 ให้ตรงกับของจริง
 * base64 นี้คือ PDF ขั้นต่ำที่ react-pdf โหลดได้
 */
async function mockGenerateContractSuccess(page) {
  await page.route("**/api/generate-contract", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        // backend จริงส่ง 2 เวอร์ชัน (preview ไม่มีรหัส / download มีรหัส)
        // ใน mock ใช้ base64 เดียวกันทั้งคู่ก็พอสำหรับตรวจ flow
        base64:
          "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
        base64Preview:
          "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
        base64Download:
          "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
        fileName: "contract_test.pdf",
      }),
    });
  });
}

// ชื่อเดิม เก็บไว้เป็น alias เพื่อไม่ให้เทสต์ที่ import ชื่อเก่าพัง
const mockGenerateContractBlobSuccess = mockGenerateContractSuccess;

/**
 * Mock update-income สำเร็จ
 */
async function mockUpdateIncomeSuccess(page) {
  await page.route("**/api/update-income", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

/**
 * Mock encrypt (crypto) — ส่ง encrypted string กลับ
 * endpoint จริงคือ utils/encryption (ดู src/api/crypto.js)
 */
async function mockEncrypt(page) {
  await page.route("**/utils/encryption", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ encrypted: "mock-encrypted-value" }),
    });
  });
}

/**
 * Setup all mocks for happy path (ระบบเปิด, verify สำเร็จ, ฯลฯ)
 */
async function mockAllHappyPath(page) {
  await mockSystemOpen(page);
  await mockEncrypt(page);
  await mockVerifySuccess(page);
  await mockCheckPlanSuccess(page);
  await mockSaveDebtSuccess(page);
  await mockContractHtmlSuccess(page);
  await mockGenerateContractBlobSuccess(page);
  await mockGeneratePdfSuccess(page);
  await mockCancelPlanSuccess(page);
  await mockUpdateIncomeSuccess(page);
}

module.exports = {
  mockAppConfig,
  mockSystemOpen,
  mockSystemClosed,
  mockVerifySuccess,
  mockVerifyFail,
  mockVerifyServerError,
  mockCheckPlanSuccess,
  mockCheckPlanFail,
  mockSaveDebtSuccess,
  mockSaveDebtFail,
  mockCancelPlanSuccess,
  mockGeneratePdfSuccess,
  mockGeneratePdfFail,
  mockContractHtmlSuccess,
  mockGenerateContractSuccess,
  mockGenerateContractBlobSuccess,
  mockUpdateIncomeSuccess,
  mockEncrypt,
  mockAllHappyPath,
};
