// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockAppConfig,
  mockSystemOpen,
  mockEncrypt,
  mockVerifySuccess,
  mockUpdateIncomeSuccess,
} = require("./helpers/mock-api");
const {
  goToConsent,
  passConsentToForm,
  setSessionToken,
} = require("./helpers/navigation");

const TOKEN = "mock-jwt-token-for-testing";
const WARN_TITLE = "Session ใกล้หมดอายุ";
const OVER_LIMIT_TITLE = "มีผู้ใช้งานเข้าใช้มากเกินไป";

/** ค่า config มาตรฐานสำหรับเทสต์ timeout (เตือนที่ 3 วิ, ตัดที่ 6 วิ) */
const FAST_TIMEOUT = { sessionTimeout: 6, sessionWarning: 3, maxConnections: 5 };

async function getToken(page) {
  return page.evaluate(() => sessionStorage.getItem("drrs_session_token"));
}

test.describe("SessionGuard (session timeout / จำกัด tab / สิทธิ์เข้าถึง)", () => {
  // ===== SESSION TIMEOUT =====

  test.describe("Session Timeout", () => {
    test.beforeEach(async ({ page }) => {
      await mockAppConfig(page, FAST_TIMEOUT);
      await mockSystemOpen(page);
      await mockEncrypt(page);
    });

    test("ปล่อยไว้ไม่ใช้งาน → ขึ้น dialog เตือน พร้อมนับถอยหลังและ 2 ปุ่ม", async ({
      page,
    }) => {
      await passConsentToForm(page);

      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("ท่านไม่มีการใช้งานในระบบ ระบบจะออกจากหน้านี้ใน")
      ).toBeVisible();
      await expect(page.getByText("วินาที")).toBeVisible();
      await expect(page.getByRole("button", { name: "ยังอยู่ในระบบ" })).toBeVisible();
      await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
    });

    test("dialog เตือน → ตัวเลขนับถอยหลังลดลงจริง", async ({ page }) => {
      await passConsentToForm(page);
      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });

      const readCountdown = async () => {
        const txt = await page
          .locator(".MuiDialog-root h2")
          .filter({ hasText: /^\d+$/ })
          .first()
          .textContent();
        return Number((txt || "").trim());
      };

      const first = await readCountdown();
      expect(first).toBeGreaterThan(0);

      await expect
        .poll(async () => await readCountdown(), { timeout: 4000 })
        .toBeLessThan(first);
    });

    test("กด 'ยังอยู่ในระบบ' → dialog ปิด และไม่ถูกตัดออกจากระบบ", async ({ page }) => {
      await passConsentToForm(page);
      await setSessionToken(page);
      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "ยังอยู่ในระบบ" }).click();

      await expect(page.getByText(WARN_TITLE)).toBeHidden();
      await expect(page).toHaveURL(/\/drrs\/form/);
      expect(await getToken(page)).toBe(TOKEN);
    });

    test("กด 'ออกจากระบบ' → ล้าง token และกลับหน้า consent", async ({ page }) => {
      await passConsentToForm(page);
      await setSessionToken(page);
      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "ออกจากระบบ" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/);
      expect(await getToken(page)).toBeNull();
    });

    test("นับถอยหลังหมด → ตัดออกจากระบบเอง กลับหน้า consent", async ({ page }) => {
      await passConsentToForm(page);
      await setSessionToken(page);

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 20000 });
      expect(await getToken(page)).toBeNull();
    });

    test("มีการใช้งานก่อนถึงเวลาเตือน → เลื่อนเวลาออกไป (ยังไม่ขึ้น dialog)", async ({
      page,
    }) => {
      await passConsentToForm(page);

      // ขยับเมาส์ทุก 1 วินาที เป็นเวลา 5 วินาที (นานกว่าเวลาที่ควรเตือนคือ 3 วินาที)
      for (let i = 0; i < 5; i += 1) {
        await page.mouse.move(100 + i * 10, 100 + i * 10);
        await page.waitForTimeout(1000);
      }

      await expect(page.getByText(WARN_TITLE)).toBeHidden();
      await expect(page).toHaveURL(/\/drrs\/form/);
    });

    test("dialog เตือนแล้ว → ขยับเมาส์ไม่ช่วยต่อเวลา (ต้องกดปุ่มเท่านั้น)", async ({
      page,
    }) => {
      await passConsentToForm(page);
      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });

      // ขยับเมาส์ระหว่างที่ dialog แสดงอยู่ — ตามดีไซน์ต้องไม่ reset timer
      await page.mouse.move(200, 200);
      await page.mouse.move(220, 220);

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 15000 });
    });

    test("หน้า consent ไม่มี SessionGuard → ปล่อยไว้นานก็ไม่ขึ้น dialog เตือน", async ({
      page,
    }) => {
      await goToConsent(page);

      await page.waitForTimeout(8000);

      await expect(page.getByText(WARN_TITLE)).toBeHidden();
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });

  // ===== TAB LIMIT =====

  test.describe("จำกัดจำนวน tab", () => {
    test("เปิด tab เกินจำนวนที่กำหนด → ขึ้น dialog แจ้งผู้ใช้งานมากเกินไป", async ({
      context,
    }) => {
      const page1 = await context.newPage();
      await mockAppConfig(page1, { maxConnections: 1 });
      await mockSystemOpen(page1);
      await mockEncrypt(page1);
      await passConsentToForm(page1);

      const page2 = await context.newPage();
      await mockAppConfig(page2, { maxConnections: 1 });
      await mockSystemOpen(page2);
      await mockEncrypt(page2);
      await passConsentToForm(page2);

      // tab ที่ 2 ทำให้จำนวนรวมเกิน 1
      await expect(page2.getByText(OVER_LIMIT_TITLE)).toBeVisible({ timeout: 15000 });
      await expect(page2.getByText("กรุณาลองใหม่ในภายหลัง")).toBeVisible();

      await page2.close();
      await page1.close();
    });

    test("dialog เกินจำนวน → กดตกลง แล้วล้าง token กลับหน้า consent", async ({
      context,
    }) => {
      const page1 = await context.newPage();
      await mockAppConfig(page1, { maxConnections: 1 });
      await mockSystemOpen(page1);
      await mockEncrypt(page1);
      await passConsentToForm(page1);

      const page2 = await context.newPage();
      await mockAppConfig(page2, { maxConnections: 1 });
      await mockSystemOpen(page2);
      await mockEncrypt(page2);
      await passConsentToForm(page2);
      await setSessionToken(page2);

      await expect(page2.getByText(OVER_LIMIT_TITLE)).toBeVisible({ timeout: 15000 });
      await page2.getByRole("button", { name: "ตกลง" }).click();

      await expect(page2).toHaveURL(/\/drrs\/consent/);
      expect(await getToken(page2)).toBeNull();

      await page2.close();
      await page1.close();
    });

    test("จำนวน tab ไม่เกินที่กำหนด → ไม่ขึ้น dialog", async ({ page }) => {
      await mockAppConfig(page, { maxConnections: 5 });
      await mockSystemOpen(page);
      await mockEncrypt(page);
      await passConsentToForm(page);

      await page.waitForTimeout(2000);

      await expect(page.getByText(OVER_LIMIT_TITLE)).toBeHidden();
    });

    test("เกินจำนวน tab → ไม่แสดง dialog เตือน timeout ซ้อนกัน", async ({ context }) => {
      const cfg = { ...FAST_TIMEOUT, maxConnections: 1 };

      const page1 = await context.newPage();
      await mockAppConfig(page1, cfg);
      await mockSystemOpen(page1);
      await mockEncrypt(page1);
      await passConsentToForm(page1);

      const page2 = await context.newPage();
      await mockAppConfig(page2, cfg);
      await mockSystemOpen(page2);
      await mockEncrypt(page2);
      await passConsentToForm(page2);

      await expect(page2.getByText(OVER_LIMIT_TITLE)).toBeVisible({ timeout: 15000 });
      // แม้ timeout จะครบ ก็ต้องไม่แสดง dialog เตือน session ซ้อนขึ้นมา
      await expect(page2.getByText(WARN_TITLE)).toBeHidden();

      await page2.close();
      await page1.close();
    });
  });

  // ===== TOKEN HANDLING =====

  test.describe("การจัดการ token", () => {
    test.beforeEach(async ({ page }) => {
      await mockAppConfig(page);
      await mockSystemOpen(page);
      await mockEncrypt(page);
    });

    test("กลับมาหน้า consent → ล้าง token ทุกครั้ง", async ({ page }) => {
      await goToConsent(page);
      await setSessionToken(page);
      expect(await getToken(page)).toBe(TOKEN);

      await goToConsent(page);

      expect(await getToken(page)).toBeNull();
    });

    test("หลัง verify สำเร็จ → ทุก request ถัดไปแนบ Authorization header", async ({
      page,
    }) => {
      await mockVerifySuccess(page);

      /** @type {string | undefined} */
      let authHeader;
      await page.route("**/api/update-income", (route) => {
        authHeader = route.request().headers()["authorization"];
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      const { fillIndividualForm, submitButton } = require("./helpers/form");
      await passConsentToForm(page);
      await fillIndividualForm(page);
      await submitButton(page).click();

      await page.getByLabel("ระบุรายได้รวม").waitFor({ state: "visible", timeout: 20000 });
      await page.getByLabel("ระบุรายได้รวม").fill("30000");
      await page.getByLabel("ระบุค่าใช้จ่ายรวม").fill("10000");
      await page.getByRole("button", { name: "บันทึกรายได้" }).click();

      await expect(() => expect(authHeader).toBeTruthy()).toPass({ timeout: 20000 });
      expect(authHeader).toBe(`Bearer ${TOKEN}`);
    });

    test("ไม่มี token → request ไม่แนบ Authorization header", async ({ page }) => {
      /** @type {any} */
      let headers = null;
      await page.route("**/api/checkCloseSystem", (route) => {
        headers = route.request().headers();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: true,
            data: [{ status_flag: true, appVersion: "1.0.0" }],
          }),
        });
      });

      await goToConsent(page);

      await expect(() => expect(headers).toBeTruthy()).toPass({ timeout: 15000 });
      expect(headers["authorization"]).toBeUndefined();
    });
  });

  // ===== UNAUTHORIZED ACCESS =====

  test.describe("เข้าหน้าที่ต้องมี session โดยตรง", () => {
    test.beforeEach(async ({ page }) => {
      await mockAppConfig(page);
      await mockSystemOpen(page);
      await mockEncrypt(page);
    });

    for (const path of [
      "/drrs/form",
      "/drrs/plan",
      "/drrs/plan-detail",
      "/drrs/select-plan",
      "/drrs/plan-summary",
      "/drrs/contract",
    ]) {
      test(`เข้า ${path} โดยตรง → เด้งกลับหน้า consent`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 15000 });
      });
    }

    test("เข้า path ที่ไม่มีในระบบ → เด้งกลับหน้า consent", async ({ page }) => {
      await page.goto("/drrs/ไม่มีหน้านี้");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });
});
