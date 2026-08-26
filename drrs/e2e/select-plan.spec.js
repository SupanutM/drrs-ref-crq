// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockVerifySuccess,
  mockUpdateIncomeSuccess,
  mockSaveDebtSuccess,
  mockSaveDebtFail,
  mockContractHtmlSuccess,
  mockGenerateContractBlobSuccess,
} = require("./helpers/mock-api");
const {
  goToConsent,
  goThroughFormToPlanPreview,
  goThroughToSelectPlan,
  gotoWithRouterState,
} = require("./helpers/navigation");
const { mockRouterState } = require("./helpers/test-data");

/** state ที่มี 2 บัญชี ใช้ทดสอบกรณีเลือกไม่ครบทุกบัญชี */
function twoAccountState() {
  const acc1 = mockRouterState.targetInfo.accounts[0];
  return {
    ...mockRouterState,
    targetInfo: {
      ...mockRouterState.targetInfo,
      accounts: [
        acc1,
        { ...acc1, accountNo: "ACC002" },
      ],
    },
  };
}

test.describe("หน้า PlanPreview / SelectPlan (เลือกแผน)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
    await mockVerifySuccess(page);
    await mockUpdateIncomeSuccess(page);
  });

  // ===== ACCESS CONTROL =====

  test.describe("Access Control", () => {
    test("เข้า /drrs/select-plan ตรงๆ → เด้งกลับ consent", async ({ page }) => {
      await page.goto("/drrs/select-plan");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("เข้า /drrs/plan-preview ตรงๆ → หน้ายังแสดง (ไม่มี guard)", async ({ page }) => {
      await page.goto("/drrs/plan-preview");

      // PlanPreview ไม่ได้ตรวจ routerState จึงเข้าถึงได้โดยตรง
      await expect(page).toHaveURL(/\/drrs\/plan-preview/);
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible();
    });

    test("เข้า plan-preview ตรงๆ แล้วกดต่อ → select-plan ไม่มี state จึงเด้งกลับ consent", async ({
      page,
    }) => {
      await page.goto("/drrs/plan-preview");
      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });

  // ===== REAL FLOW =====

  test.describe("Flow จริงจากหน้าฟอร์ม", () => {
    test("form → verify → บันทึกรายได้ → ถึงหน้า plan-preview", async ({ page }) => {
      await goThroughFormToPlanPreview(page);

      await expect(page).toHaveURL(/\/drrs\/plan-preview/);
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible();
    });

    test("plan-preview → กดดำเนินการต่อ → ถึงหน้า select-plan", async ({ page }) => {
      await goThroughToSelectPlan(page);

      await expect(page).toHaveURL(/\/drrs\/select-plan/);
      await expect(
        page.getByRole("heading", { name: "เลือกแผนการชำระหนี้" })
      ).toBeVisible();
    });

    test("select-plan แสดงเลขบัญชีและแผนครบทั้ง 2 ทางเลือก", async ({ page }) => {
      await goThroughToSelectPlan(page);

      await expect(page.getByText("1. บัญชีเลขที่ ACC001")).toBeVisible();
      await expect(page.getByText("ผ่อนชำระ", { exact: true })).toBeVisible();
      await expect(page.getByText("ปิดบัญชีเลขที่ ACC001")).toBeVisible();
    });

    test("select-plan แสดงรายได้สุทธิที่กรอกไว้จากหน้าก่อน", async ({ page }) => {
      await goThroughToSelectPlan(page, { totalIncome: "30000", totalCost: "10000" });

      // 30000 - 10000 = 20000
      await expect(page.getByText("รายได้สุทธิปัจจุบัน:")).toBeVisible();
      await expect(page.getByText("20,000")).toBeVisible();
    });
  });

  // ===== SELECTION BEHAVIOUR =====

  test.describe("การเลือกแผน", () => {
    test("ยังไม่เลือกแผน → ปุ่มยืนยันถูก disable", async ({ page }) => {
      await goThroughToSelectPlan(page);

      await expect(
        page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" })
      ).toBeDisabled();
    });

    test("เลือกแผน → ปุ่มยืนยันกดได้ และ radio ถูกติ๊ก", async ({ page }) => {
      await goThroughToSelectPlan(page);

      await page.getByText("ผ่อนชำระ", { exact: true }).click();

      await expect(page.getByRole("radio").first()).toBeChecked();
      await expect(
        page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" })
      ).toBeEnabled();
    });

    test("คลิกแผนเดิมซ้ำ → ยกเลิกการเลือก และปุ่มยืนยัน disable อีกครั้ง", async ({
      page,
    }) => {
      await goThroughToSelectPlan(page);

      const plan = page.getByText("ผ่อนชำระ", { exact: true });
      await plan.click();
      await expect(
        page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" })
      ).toBeEnabled();

      await plan.click();
      await expect(
        page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" })
      ).toBeDisabled();
    });

    test("เลือกได้ทีละแผนต่อบัญชี (เลือกแผนใหม่แทนแผนเดิม)", async ({ page }) => {
      await goThroughToSelectPlan(page);

      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByText("ปิดบัญชีเลขที่ ACC001").click();

      const radios = page.getByRole("radio");
      await expect(radios.nth(0)).not.toBeChecked();
      await expect(radios.nth(1)).toBeChecked();
    });

    test("บัญชีที่ลงทะเบียนแล้ว → แสดงหมายเหตุ และเลือกไม่ได้", async ({ page }) => {
      const registered = {
        ...mockRouterState,
        targetInfo: {
          ...mockRouterState.targetInfo,
          accounts: [
            { ...mockRouterState.targetInfo.accounts[0], isRegistered: true },
          ],
        },
      };
      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", registered);

      await expect(
        page.getByText("(บัญชีนี้ได้ทำการเลือกลงทะเบียนไปแล้ว)")
      ).toBeVisible();
      await expect(page.getByRole("radio").first()).toBeDisabled();
    });

    test("บัญชีที่ไม่มีแผนในระบบ → แจ้งให้ติดต่อเจ้าหน้าที่", async ({ page }) => {
      const noPlans = {
        ...mockRouterState,
        targetInfo: {
          ...mockRouterState.targetInfo,
          accounts: [
            { ...mockRouterState.targetInfo.accounts[0], masterPlan: [] },
          ],
        },
      };
      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", noPlans);

      await expect(
        page.getByText(
          "ไม่พบข้อมูลแผนการชำระหนี้สำหรับบัญชีนี้ในระบบ (กรุณาติดต่อเจ้าหน้าที่)"
        )
      ).toBeVisible();
    });
  });

  // ===== SAVE (HAPPY PATH) =====

  test.describe("บันทึกแผน - สำเร็จ", () => {
    test("เลือกแผน → ยืนยัน → ส่ง payload ถูกต้อง → ขึ้น modal สำเร็จ", async ({
      page,
    }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/debt-restructure", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            template: { conditionMonth: "กันยายน", conditionYear: "2569", items: [] },
          }),
        });
      });

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
      ).toBeVisible({ timeout: 15000 });

      expect(Array.isArray(sentBody)).toBe(true);
      expect(sentBody).toHaveLength(1);
      expect(sentBody[0]).toMatchObject({
        cusTargetId: "CUS001",
        accountNo: "ACC001",
        planNo: "PLAN01",
        loantype: "LT",
      });
    });

    test("กดดำเนินการต่อใน modal สำเร็จ → ไปหน้า plan-summary", async ({ page }) => {
      await mockSaveDebtSuccess(page);
      await mockContractHtmlSuccess(page);
      await mockGenerateContractBlobSuccess(page);

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();

      await expect(page).toHaveURL(/\/drrs\/plan-summary/, { timeout: 20000 });
      await expect(page.getByText("สรุปแผนการชำระหนี้")).toBeVisible();
    });

    test("แผนปิดบัญชี (Haircut) → ส่ง loantype = HC", async ({ page }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/debt-restructure", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            template: { conditionMonth: "กันยายน", conditionYear: "2569", items: [] },
          }),
        });
      });

      await goThroughToSelectPlan(page);
      await page.getByText("ปิดบัญชีเลขที่ ACC001").click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
      ).toBeVisible({ timeout: 15000 });
      expect(sentBody[0]).toMatchObject({ planNo: "PLAN02", loantype: "HC" });
    });
  });

  // ===== INCOMPLETE SELECTION =====

  test.describe("เลือกไม่ครบทุกบัญชี", () => {
    test("มี 2 บัญชี เลือกแค่ 1 → เตือนว่าแจ้งไม่ครบทุกบัญชี", async ({ page }) => {
      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", twoAccountState());

      await page.getByText("ผ่อนชำระ", { exact: true }).first().click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(page.getByText("ท่านแจ้งความประสงค์ไม่ครบทุกบัญชี")).toBeVisible();
    });

    test("ยืนยันทำเฉพาะบัญชีที่เลือก → บันทึกเฉพาะบัญชีนั้น", async ({ page }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/debt-restructure", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            template: { conditionMonth: "กันยายน", conditionYear: "2569", items: [] },
          }),
        });
      });

      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", twoAccountState());

      await page.getByText("ผ่อนชำระ", { exact: true }).first().click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();
      await page
        .getByRole("button", { name: "ยืนยันทำรายการเฉพาะบัญชีที่เลือก" })
        .click();

      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
      ).toBeVisible({ timeout: 15000 });
      expect(sentBody).toHaveLength(1);
      expect(sentBody[0].accountNo).toBe("ACC001");
    });

    test("เลือกบัญชีเพิ่มเติม → ปิด modal และยังไม่บันทึก", async ({ page }) => {
      let saveCalled = false;
      await page.route("**/api/debt-restructure", (route) => {
        saveCalled = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, template: { items: [] } }),
        });
      });

      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", twoAccountState());

      await page.getByText("ผ่อนชำระ", { exact: true }).first().click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();
      await page.getByRole("button", { name: "เลือกบัญชีเพิ่มเติม" }).click();

      await expect(page.getByText("ท่านแจ้งความประสงค์ไม่ครบทุกบัญชี")).toBeHidden();
      expect(saveCalled).toBe(false);
    });

    test("เลือกครบทุกบัญชี → ไม่ขึ้น modal เตือน", async ({ page }) => {
      await mockSaveDebtSuccess(page);

      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/select-plan", twoAccountState());

      await page.getByText("ผ่อนชำระ", { exact: true }).nth(0).click();
      await page.getByText("ผ่อนชำระ", { exact: true }).nth(1).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(page.getByText("ท่านแจ้งความประสงค์ไม่ครบทุกบัญชี")).toBeHidden();
      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
      ).toBeVisible({ timeout: 15000 });
    });
  });

  // ===== INCOME VALIDATION =====

  test.describe("ตรวจรายได้สุทธิ", () => {
    test("รายได้สุทธิน้อยกว่ายอดขั้นต่ำ → เตือนและไม่ยิง API บันทึก", async ({ page }) => {
      let saveCalled = false;
      await page.route("**/api/debt-restructure", (route) => {
        saveCalled = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, template: { items: [] } }),
        });
      });

      // minAmount ของบัญชีคือ 5,000 → กรอกรายได้สุทธิ 2,000
      await goThroughToSelectPlan(page, { totalIncome: "3000", totalCost: "1000" });

      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(page.getByText("รายได้สุทธิไม่เพียงพอชำระหนี้")).toBeVisible();
      expect(saveCalled).toBe(false);
    });

    test("modal เตือนรายได้ → มีปุ่มให้ระบุรายได้อื่นๆ เปิด modal รายได้", async ({
      page,
    }) => {
      await goThroughToSelectPlan(page, { totalIncome: "3000", totalCost: "1000" });

      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();
      await expect(page.getByText("รายได้สุทธิไม่เพียงพอชำระหนี้")).toBeVisible();

      await page.getByRole("button", { name: "ระบุรายได้อื่นๆ คลิก !" }).click();

      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible();
    });

    test("แผนที่ไม่ต้องตรวจรายได้ (Haircut) → รายได้น้อยก็บันทึกได้", async ({ page }) => {
      await mockSaveDebtSuccess(page);

      // PLAN02 (HC) ตั้ง isCheckIncome = "0" จึงข้ามการตรวจรายได้
      await goThroughToSelectPlan(page, { totalIncome: "3000", totalCost: "1000" });

      await page.getByText("ปิดบัญชีเลขที่ ACC001").click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
      ).toBeVisible({ timeout: 15000 });
    });
  });

  // ===== SAVE ERRORS =====

  test.describe("บันทึกแผน - ผิดพลาด", () => {
    test("API ตอบ success=false → แสดงข้อความจาก API", async ({ page }) => {
      await mockSaveDebtFail(page);

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByText("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง")
      ).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL(/\/drrs\/select-plan/);
    });

    test("API ตอบ 500 → แสดงข้อความ error จาก backend", async ({ page }) => {
      await page.route("**/api/debt-restructure", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้" }),
        })
      );

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByText("ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้")
      ).toBeVisible({ timeout: 15000 });
    });

    test("network error → แสดง modal เตือน และไม่เปลี่ยนหน้า", async ({ page }) => {
      await page.route("**/api/debt-restructure", (route) => route.abort("failed"));

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(
        page.getByRole("button", { name: "ระบุรายได้อื่นๆ คลิก !" })
      ).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL(/\/drrs\/select-plan/);
    });

    test("backend เตือนรายได้ไม่พอ → frontend จัดรูปแบบข้อความให้อ่านง่าย", async ({
      page,
    }) => {
      await page.route("**/api/debt-restructure", (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            message:
              "รายได้สุทธิไม่เพียงพอชำระหนี้ (รายได้สุทธิปัจจุบัน: 20,000 / ต้องมียอดขั้นต่ำรวม: 99,000)",
          }),
        })
      );

      await goThroughToSelectPlan(page);
      await page.getByText("ผ่อนชำระ", { exact: true }).click();
      await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();

      await expect(page.getByText("รายได้สุทธิไม่เพียงพอชำระหนี้")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("99,000")).toBeVisible();
    });
  });
});
