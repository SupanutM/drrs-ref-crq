// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockContractHtmlSuccess,
  mockGenerateContractBlobSuccess,
  mockCancelPlanSuccess,
} = require("./helpers/mock-api");
const { goToConsent, gotoWithRouterState } = require("./helpers/navigation");
const { mockRouterState } = require("./helpers/test-data");

/** state ที่หน้า plan-summary ต้องได้รับ (ปกติมาจาก SelectPlan) */
const summaryState = {
  ...mockRouterState,
  selectedPlans: { ACC001: "PLAN01" },
  template: {
    conditionMonth: "กันยายน",
    conditionYear: "2569",
    items: [{ desc: "แผนปรับโครงสร้างหนี้", qty: 1, price: "5,000 บาท/เดือน" }],
  },
  customerInfo: mockRouterState.targetInfo,
  selectedAccounts: [
    {
      accountNo: "ACC001",
      loanType: "LT",
      principal: 100000,
      interest: 3,
      paymentAmount: 5000,
      isHaircut: false,
    },
  ],
};

async function openSummary(page, state = summaryState) {
  await goToConsent(page);
  await gotoWithRouterState(page, "/drrs/plan-summary", state);
}

const AGREE_TEXT = "ข้าพเจ้าได้อ่านและเข้าใจข้อความโดยครบถ้วนแล้ว";

test.describe("หน้า PlanSummary (สรุปแผน + สัญญา)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
  });

  // ===== ACCESS CONTROL =====

  test.describe("Access Control", () => {
    test("เข้า /drrs/plan-summary ตรงๆ → เด้งกลับ consent", async ({ page }) => {
      await page.goto("/drrs/plan-summary");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("กดปุ่ม Back ของเบราว์เซอร์ → ยังอยู่หน้าเดิม (ล็อกไม่ให้ย้อน)", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);
      await expect(page.getByText("สรุปแผนการชำระหนี้")).toBeVisible();

      await page.goBack();

      await expect(page).toHaveURL(/\/drrs\/plan-summary/);
    });
  });

  // ===== HAPPY PATH =====

  test.describe("Happy Path", () => {
    test("แสดงหัวข้อและเนื้อหาสัญญาที่ดึงจาก API", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);

      await expect(page.getByText("สรุปแผนการชำระหนี้")).toBeVisible();
      await expect(page.getByText("สัญญาปรับโครงสร้างหนี้")).toBeVisible({
        timeout: 15000,
      });
    });

    test("ส่ง cusTargetId และบัญชีที่เลือกไปให้ API สัญญา", async ({ page }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/preview-contract-html", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify("<div>สัญญาปรับโครงสร้างหนี้</div>"),
        });
      });

      await openSummary(page);
      await expect(page.getByText("สัญญาปรับโครงสร้างหนี้")).toBeVisible({
        timeout: 15000,
      });

      expect(sentBody).toMatchObject({
        customerInfo: { cusTargetId: "CUS001" },
      });
      expect(sentBody.selectedAccounts).toHaveLength(1);
      expect(sentBody.selectedAccounts[0].accountNo).toBe("ACC001");
    });

    test("ยังไม่ติ๊กยอมรับ → ปุ่มยอมรับถูก disable", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);

      await expect(page.getByRole("button", { name: "ยอมรับ" })).toBeDisabled();
    });

    test("ติ๊กยอมรับ → ปุ่มยอมรับกดได้", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);

      await page.getByRole("checkbox").check();

      await expect(page.getByRole("button", { name: "ยอมรับ" })).toBeEnabled();
    });

    test("คลิกข้อความยอมรับ → ติ๊ก checkbox ให้ด้วย", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);

      await page.getByText(AGREE_TEXT).click();

      await expect(page.getByRole("checkbox")).toBeChecked();
    });

    test("กดยอมรับ → ขึ้น modal ยืนยันดาวน์โหลดสัญญา พร้อมบอกรหัสเปิดไฟล์", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page);

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "ยอมรับ" }).click();

      await expect(page.getByText("ดาวน์โหลดสัญญา", { exact: true })).toBeVisible();
      await expect(page.getByText(/รหัสผ่านสำหรับเปิดไฟล์คือ วันเดือนปีเกิด/)).toBeVisible();
      await expect(page.getByRole("button", { name: "ดาวน์โหลด" })).toBeVisible();
    });

    test("ยืนยันดาวน์โหลด → เรียก API สร้างสัญญา และดาวน์โหลดไฟล์ PDF", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);
      await mockGenerateContractBlobSuccess(page);
      await openSummary(page);

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "ยอมรับ" }).click();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: "ดาวน์โหลด" }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });

    test("ดาวน์โหลดเสร็จ → พากลับหน้า consent", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await mockGenerateContractBlobSuccess(page);
      await openSummary(page);

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "ยอมรับ" }).click();
      await page.getByRole("button", { name: "ดาวน์โหลด" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 25000 });
    });
  });

  // ===== CANCEL =====

  test.describe("ยกเลิก", () => {
    test("กดยกเลิก → เรียก API ยกเลิกแผนด้วยเลขบัญชีที่เลือก แล้วกลับ consent", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);

      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/cancel-plan", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await openSummary(page);
      await page.getByRole("button", { name: "ยกเลิก" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 20000 });
      expect(sentBody).toEqual({ accounts: ["ACC001"] });
    });

    test("API ยกเลิกล้มเหลว → ยังพากลับ consent (ไม่ค้างหน้า)", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await page.route("**/api/cancel-plan", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server Error" }),
        })
      );

      await openSummary(page);
      await page.getByRole("button", { name: "ยกเลิก" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 20000 });
    });

    test("ไม่มีบัญชีที่เลือก → ไม่เรียก API ยกเลิก แต่ยังกลับ consent ได้", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);
      await mockCancelPlanSuccess(page);

      let cancelCalled = false;
      await page.route("**/api/cancel-plan", (route) => {
        cancelCalled = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      await openSummary(page, { ...summaryState, selectedAccounts: [] });
      await page.getByRole("button", { name: "ยกเลิก" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 20000 });
      expect(cancelCalled).toBe(false);
    });
  });

  // ===== ERROR CASES =====

  test.describe("Error Cases", () => {
    test("ดึงเนื้อหาสัญญาไม่ได้ (500) → แจ้งให้ลองใหม่", async ({ page }) => {
      await page.route("**/api/preview-contract-html", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Server Error" }),
        })
      );

      await openSummary(page);

      await expect(
        page.getByText("ไม่สามารถโหลดข้อมูลสัญญากรุณาลองใหม่อีกครั้ง")
      ).toBeVisible({ timeout: 15000 });
    });

    test("ดึงเนื้อหาสัญญา network error → แจ้งให้ลองใหม่", async ({ page }) => {
      await page.route("**/api/preview-contract-html", (route) =>
        route.abort("failed")
      );

      await openSummary(page);

      await expect(
        page.getByText("ไม่สามารถโหลดข้อมูลสัญญากรุณาลองใหม่อีกครั้ง")
      ).toBeVisible({ timeout: 15000 });
    });

    test("ระหว่างโหลดสัญญา → แสดงสถานะกำลังโหลด", async ({ page }) => {
      await page.route("**/api/preview-contract-html", async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify("<div>สัญญาปรับโครงสร้างหนี้</div>"),
        });
      });

      await openSummary(page);

      await expect(page.getByText("กำลังโหลดข้อมูลสัญญา...")).toBeVisible();
    });

    test("ไม่มีบัญชีที่เลือก → ปุ่มยอมรับ disable แม้ติ๊กยอมรับแล้ว", async ({ page }) => {
      await mockContractHtmlSuccess(page);
      await openSummary(page, { ...summaryState, selectedAccounts: [] });

      await page.getByRole("checkbox").check();

      await expect(page.getByRole("button", { name: "ยอมรับ" })).toBeDisabled();
    });

    test("สร้าง PDF สัญญาไม่ได้ (500) → ไม่ดาวน์โหลด แต่ยังพากลับ consent", async ({
      page,
    }) => {
      await mockContractHtmlSuccess(page);
      await page.route("**/api/generate-contract", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "PDF generation failed" }),
        })
      );

      await openSummary(page);
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "ยอมรับ" }).click();
      await page.getByRole("button", { name: "ดาวน์โหลด" }).click();

      // controller ดัก error แล้วยัง submit ต่อ → กลับไป consent
      await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 25000 });
    });
  });
});
