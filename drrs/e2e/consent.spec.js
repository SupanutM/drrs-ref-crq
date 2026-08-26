// @ts-check
const { test, expect } = require("@playwright/test");
const { mockSystemOpen, mockSystemClosed } = require("./helpers/mock-api");
const { goToConsent } = require("./helpers/navigation");

test.describe("หน้า Consent (ยินยอม)", () => {
  // ===== HAPPY PATH =====

  test.describe("Happy Path", () => {
    test.beforeEach(async ({ page }) => {
      await mockSystemOpen(page);
    });

    test("แสดงหน้ายินยอมพร้อมข้อความและ checkbox", async ({ page }) => {
      await goToConsent(page);

      // ต้องเห็นหัวข้อ
      await expect(page.getByRole("heading", { name: "ข้อตกลงในการลงทะเบียน" })).toBeVisible();

      // ต้องเห็น checkbox
      await expect(page.getByRole("checkbox")).toBeVisible();
      await expect(page.getByRole("checkbox")).not.toBeChecked();

      // ต้องเห็นปุ่มยอมรับ
      await expect(page.getByRole("button", { name: "ยอมรับ" })).toBeVisible();
    });

    test("ติ๊ก checkbox แล้วกดยอมรับ → ไปหน้า form-register", async ({ page }) => {
      await goToConsent(page);

      // ติ๊ก checkbox
      await page.getByRole("checkbox").check();
      await expect(page.getByRole("checkbox")).toBeChecked();

      // กดยอมรับ
      await page.getByRole("button", { name: "ยอมรับ" }).click();

      // ต้อง navigate ไปหน้า form
      await expect(page).toHaveURL(/\/drrs\/form/);
    });

    test("เข้าหน้า consent → ล้าง session token", async ({ page }) => {
      // Set token ก่อน
      await page.goto("/drrs/consent");
      await page.evaluate(() => {
        sessionStorage.setItem("drrs_session_token", "old-token");
      });

      // Reload หน้า consent
      await goToConsent(page);

      // Token ต้องถูกล้าง
      const token = await page.evaluate(() => sessionStorage.getItem("drrs_session_token"));
      expect(token).toBeNull();
    });
  });

  // ===== ERROR CASES =====

  test.describe("Error Cases", () => {
    test("กดยอมรับโดยไม่ติ๊ก checkbox → แสดง alert warning", async ({ page }) => {
      await mockSystemOpen(page);
      await goToConsent(page);

      // กดยอมรับโดยไม่ติ๊ก
      await page.getByRole("button", { name: "ยอมรับ" }).click();

      // ต้องแสดง alert
      await expect(page.getByText("กรุณายอมรับข้อตกลงในการลงทะเบียน")).toBeVisible();

      // ไม่ควร navigate ไปไหน
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("ระบบปิด → แสดงรูปภาพปิดระบบ ไม่แสดง form", async ({ page }) => {
      await mockSystemClosed(page);
      await goToConsent(page);

      // ต้องเห็นรูปปิดระบบ
      await expect(page.getByRole("img")).toBeVisible();

      // ไม่ควรเห็น checkbox และปุ่มยอมรับ
      await expect(page.getByRole("checkbox")).not.toBeVisible();
      await expect(page.getByRole("button", { name: "ยอมรับ" })).not.toBeVisible();
    });

    test("API check-close-system ล้มเหลว → แสดงหน้าปิดระบบ (fallback)", async ({ page }) => {
      // Mock API error
      await page.route("**/api/checkCloseSystem", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server Error" }),
        });
      });

      await goToConsent(page);

      // เมื่อ API fail ระบบจะ set isClose = "OFF" (fallback)
      await expect(page.getByRole("img")).toBeVisible();
    });

    test("เข้า URL / → redirect ไป /drrs/consent", async ({ page }) => {
      await mockSystemOpen(page);
      await page.goto("/");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("เข้า URL ที่ไม่มี → redirect ไป /drrs/consent", async ({ page }) => {
      await mockSystemOpen(page);
      await page.goto("/nonexistent-page");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });
});
