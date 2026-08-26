// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockCheckPlanSuccess,
  mockCheckPlanFail,
} = require("./helpers/mock-api");
const { gotoWithRouterState } = require("./helpers/navigation");
const { mockRouterState } = require("./helpers/test-data");

test.describe("หน้า LoanPlan / LoanPlanDetails (เลือกแผน - เส้นทาง legacy)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
  });

  // ===== ACCESS CONTROL =====
  // guard ของกลุ่มนี้ต่อกันเป็นลูกโซ่:
  // /drrs/contract -> /drrs/plan-detail -> /drrs/plan -> /drrs/form -> /drrs/consent

  test.describe("Access Control (guard ลูกโซ่)", () => {
    test("เข้า /drrs/plan ตรงๆ → เด้งกลับจนถึง consent", async ({ page }) => {
      await page.goto("/drrs/plan");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("เข้า /drrs/plan-detail ตรงๆ → เด้งกลับจนถึง consent", async ({ page }) => {
      await page.goto("/drrs/plan-detail");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("มี state แต่ไม่มี selectedPlan → /drrs/plan-detail เด้งกลับ /drrs/plan", async ({
      page,
    }) => {
      // ส่ง state ที่ไม่มี selectedPlan → LoanPlanDetails ต้องเด้งไป /drrs/plan
      // ซึ่ง /drrs/plan มี state (เพราะ replace ไม่ส่ง state ต่อ) จึงเด้งต่อไป form -> consent
      await gotoWithRouterState(page, "/drrs/plan-detail", mockRouterState);
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });

  // ===== HAPPY PATH =====

  test.describe("Happy Path - แสดงรายการแผน", () => {
    test("มี state → แสดงหัวข้อและการ์ดแผนครบตาม masterPlan", async ({ page }) => {
      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);

      await expect(
        page.getByText("เลือกแผนการปรับปรุงโครงสร้างหนี้")
      ).toBeVisible();

      // masterPlan มี 2 แผน ต้องแสดงทั้งคู่
      await expect(page.getByText("แผนปรับโครงสร้างหนี้ A")).toBeVisible();
      await expect(page.getByText("แผนตัดหนี้ B (Haircut)")).toBeVisible();
    });

    test("ไม่มีแผนใน masterPlan → ไม่แสดงการ์ดแผน แต่หน้าไม่พัง", async ({ page }) => {
      const emptyPlans = {
        ...mockRouterState,
        targetInfo: { ...mockRouterState.targetInfo, masterPlan: [] },
      };
      await gotoWithRouterState(page, "/drrs/plan", emptyPlans);

      await expect(
        page.getByText("เลือกแผนการปรับปรุงโครงสร้างหนี้")
      ).toBeVisible();
      await expect(page.getByText("แผนปรับโครงสร้างหนี้ A")).toBeHidden();
    });

    test("คลิกแผน → check-plan ผ่าน → ไปหน้า plan-detail", async ({ page }) => {
      await mockCheckPlanSuccess(page);
      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);

      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();

      await expect(page).toHaveURL(/\/drrs\/plan-detail/, { timeout: 15000 });
      await expect(page.getByText("รายละเอียดแผนการชำระหนี้")).toBeVisible();
    });

    test("คลิกแผน → ส่ง accountNo และ planNo ที่ถูกต้องไปให้ check-plan", async ({
      page,
    }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/check-plan", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        });
      });

      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);
      await page.getByText("แผนตัดหนี้ B (Haircut)").click();
      await expect(page).toHaveURL(/\/drrs\/plan-detail/, { timeout: 15000 });

      expect(sentBody).toEqual({ accountNo: "ACC001", planNo: "PLAN02" });
    });

    test("แผน Haircut → หน้า plan-detail แสดงปุ่มปิดยอด", async ({ page }) => {
      await mockCheckPlanSuccess(page);
      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);

      await page.getByText("แผนตัดหนี้ B (Haircut)").click();
      await expect(page).toHaveURL(/\/drrs\/plan-detail/, { timeout: 15000 });

      await expect(
        page.getByRole("button", { name: /ยอมรับข้อเสนอ \(ปิดยอด\)/ })
      ).toBeVisible();
    });

    test("แผนผ่อนชำระ → หน้า plan-detail แสดงปุ่มผ่อนชำระ", async ({ page }) => {
      await mockCheckPlanSuccess(page);
      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);

      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();
      await expect(page).toHaveURL(/\/drrs\/plan-detail/, { timeout: 15000 });

      await expect(
        page.getByRole("button", { name: /ยอมรับข้อเสนอ \(ผ่อนชำระ\)/ })
      ).toBeVisible();
    });
  });

  // ===== ERROR CASES =====

  test.describe("Error Cases", () => {
    test("check-plan ตอบ status=false → แจ้งเตือนและไม่เปลี่ยนหน้า", async ({ page }) => {
      await mockCheckPlanFail(page);

      /** @type {string[]} */
      const dialogs = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });

      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);
      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 15000,
      });
      expect(dialogs[0]).toContain("ไม่สามารถเลือกแผนนี้ได้");
      await expect(page).toHaveURL(/\/drrs\/plan/);
      await expect(page).not.toHaveURL(/plan-detail/);
    });

    test("check-plan ตอบ 500 → แจ้งเตือนและไม่เปลี่ยนหน้า", async ({ page }) => {
      // checkPlan ดัก error เองแล้วคืน { status:false } → ใช้ข้อความเดียวกับกรณี status=false
      await page.route("**/api/check-plan", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server Error" }),
        })
      );

      /** @type {string[]} */
      const dialogs = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });

      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);
      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 15000,
      });
      await expect(page).not.toHaveURL(/plan-detail/);
    });

    test("check-plan network error → แจ้งเตือนและไม่เปลี่ยนหน้า", async ({ page }) => {
      await page.route("**/api/check-plan", (route) => route.abort("failed"));

      /** @type {string[]} */
      const dialogs = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.accept();
      });

      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);
      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 15000,
      });
      await expect(page).not.toHaveURL(/plan-detail/);
    });

    test("check-plan ตอบช้า → แสดงสถานะกำลังตรวจสอบสิทธิ์", async ({ page }) => {
      await page.route("**/api/check-plan", async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        });
      });

      await gotoWithRouterState(page, "/drrs/plan", mockRouterState);
      await page.getByText("แผนปรับโครงสร้างหนี้ A").click();

      await expect(page.getByText("กำลังตรวจสอบสิทธิ์ กรุณารอสักครู่...")).toBeVisible();
    });
  });
});
