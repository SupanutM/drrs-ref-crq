// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Playwright Configuration for DRRS E2E Tests
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * เปิด dev server อัตโนมัติตอนรัน test
   *
   * หมายเหตุ: ถ้ามี dev server รันอยู่แล้ว Playwright จะใช้ตัวนั้นต่อ (reuseExistingServer)
   * แนะนำให้เปิด `npm run dev` ไว้ก่อนในเทอร์มินัลแยก แล้วค่อยรันเทสต์ จะเร็วกว่ามาก
   * (ถ้าปล่อยให้ Playwright สั่งเปิดเอง แต่พอร์ต 3000 ถูกโปรเซสค้างยึดอยู่
   *  react-scripts จะถามยืนยันเปลี่ยนพอร์ตแล้วค้างรอ input)
   */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
