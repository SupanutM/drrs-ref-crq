// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Config ของชุดเทสต์ที่ยิง backend จริง (ไม่ mock API)
 *
 * ต่างจาก playwright.config.js (ชุด mock) ตรงที่:
 *  - ใช้ testDir แยก (e2e-real) และ report แยก
 *  - workers = 1 เพราะทุกเทสต์ใช้ลูกค้าคนเดียวกันใน DB ต้องรันเรียงกัน
 *  - มี globalSetup / globalTeardown สำหรับสำรองและคืนค่า DB
 *  - ไม่ retry เพราะแต่ละรอบเขียน DB จริง การ retry จะทำให้สถานะเพี้ยน
 *
 * ก่อนรัน ต้องเปิดไว้ 2 อย่าง:
 *   cd drrs-api && npm run dev     (backend :5000 + PostgreSQL)
 *   cd drrs && npm run dev         (frontend :3000)
 */
module.exports = defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 90000,
  expect: { timeout: 20000 },

  globalSetup: require.resolve("./e2e-real/global-setup.js"),
  globalTeardown: require.resolve("./e2e-real/global-teardown.js"),

  reporter: [["html", { open: "never", outputFolder: "playwright-report-real" }]],
  outputDir: "test-results-real",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
