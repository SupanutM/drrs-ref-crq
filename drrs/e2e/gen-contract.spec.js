// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockGeneratePdfSuccess,
  mockGeneratePdfFail,
} = require("./helpers/mock-api");
const { goToConsent, gotoWithRouterState } = require("./helpers/navigation");
const { mockRouterState } = require("./helpers/test-data");

/** state ที่หน้า /drrs/contract ต้องได้รับ (ปกติมาจาก LoanPlanDetails) */
const contractState = {
  ...mockRouterState,
  selectedPlan: {
    planNo: "PLAN02",
    planName: "แผนตัดหนี้ B (Haircut)",
    planDesc: "การปิดบัญชี",
    loanType: "HC",
  },
  template: {
    conditionMonth: "กันยายน",
    conditionYear: "2569",
    items: [
      { desc: "ยอดปิดบัญชี", qty: 1, price: "30,000 บาท" },
      { desc: "ค่าธรรมเนียม", qty: 1, price: "0 บาท" },
    ],
  },
};

const GENERATE_BTN = /สร้างและดูตัวอย่างเอกสาร/;
const DOWNLOAD_BTN = /ดาวน์โหลดไฟล์เอกสาร/;

async function openContract(page, state = contractState) {
  await goToConsent(page);
  await gotoWithRouterState(page, "/drrs/contract", state);
}

/** เก็บข้อความจาก window.alert เพื่อตรวจ error ที่ controller แจ้งผู้ใช้ */
function captureDialogs(page) {
  /** @type {string[]} */
  const messages = [];
  page.on("dialog", async (d) => {
    messages.push(d.message());
    await d.accept();
  });
  return messages;
}

test.describe("หน้า GenContract (สร้างเอกสารสัญญา PDF)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
  });

  // ===== ACCESS CONTROL =====

  test.describe("Access Control", () => {
    test("เข้า /drrs/contract ตรงๆ → เด้งกลับจนถึง consent", async ({ page }) => {
      await page.goto("/drrs/contract");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("มี state แต่ไม่มี selectedPlan → เด้งออกจากหน้า contract", async ({ page }) => {
      await openContract(page, { ...mockRouterState });
      await expect(page).not.toHaveURL(/\/drrs\/contract/);
    });
  });

  // ===== HAPPY PATH =====

  test.describe("Happy Path", () => {
    test("แสดงหน้าเตรียมเอกสาร พร้อมข้อมูลสัญญาและปุ่มสร้างเอกสาร", async ({ page }) => {
      await openContract(page);

      await expect(page.getByText("ระบบเอกสารอิเล็กทรอนิกส์")).toBeVisible();
      await expect(page.getByText("กันยายน")).toBeVisible();
      await expect(page.getByText("2569")).toBeVisible();
      // template มี 2 รายการ
      await expect(page.getByText("2 รายการ")).toBeVisible();
      await expect(page.getByRole("button", { name: GENERATE_BTN })).toBeEnabled();
    });

    test("แบนเนอร์แสดงชื่อแผนและรายละเอียดที่เลือกมา", async ({ page }) => {
      await openContract(page);

      await expect(page.getByText("แผนตัดหนี้ B (Haircut)")).toBeVisible();
      await expect(page.getByText(/กรุณาระบุข้อมูลสำหรับ การปิดบัญชี/)).toBeVisible();
    });

    test("กดสร้างเอกสาร → ส่งวันเกิดไปเป็นรหัสเปิดไฟล์ให้ backend", async ({ page }) => {
      /** @type {any} */
      let sentBody = null;
      await page.route("**/api/generate-pdf", (route) => {
        sentBody = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            base64:
              "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
            fileName: "contract_test.pdf",
          }),
        });
      });

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });
      expect(sentBody).toMatchObject({
        conditionMonth: "กันยายน",
        conditionYear: "2569",
        birthDate: "2530-01-15",
        userPassword: "2530-01-15",
      });
    });

    test("สร้างสำเร็จ → เข้าโหมดพรีวิว แสดง iframe และปุ่มดาวน์โหลด", async ({ page }) => {
      await mockGeneratePdfSuccess(page);
      await openContract(page);

      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });
      await expect(page.locator('iframe[title="PDF Preview"]')).toBeVisible();
      await expect(page.getByRole("button", { name: DOWNLOAD_BTN })).toBeVisible();
      await expect(page.getByText(/รหัสผ่านเปิดไฟล์ PDF/)).toBeVisible();
    });

    test("กดปิดหน้าต่างพรีวิว → กลับไปหน้าเตรียมเอกสาร", async ({ page }) => {
      await mockGeneratePdfSuccess(page);
      await openContract(page);

      await page.getByRole("button", { name: GENERATE_BTN }).click();
      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });

      await page.getByRole("button", { name: /ปิดหน้าต่าง/ }).click();

      await expect(page.getByText("ระบบเอกสารอิเล็กทรอนิกส์")).toBeVisible();
      await expect(page.getByText("พรีวิวเอกสาร")).toBeHidden();
    });

    test("กดดาวน์โหลด → ได้ไฟล์ PDF และขึ้น modal ยืนยันเสร็จสิ้น", async ({ page }) => {
      await mockGeneratePdfSuccess(page);
      await openContract(page);

      await page.getByRole("button", { name: GENERATE_BTN }).click();
      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: DOWNLOAD_BTN }).click(),
      ]);
      expect(download.suggestedFilename()).toBe("contract_test.pdf");

      await expect(
        page.getByText("บันทึกและดาวน์โหลดเอกสารเสร็จสิ้น")
      ).toBeVisible({ timeout: 15000 });
    });

    test("กดตกลงใน modal → แสดงหน้าทำรายการเสร็จสิ้น", async ({ page }) => {
      await mockGeneratePdfSuccess(page);
      await openContract(page);

      await page.getByRole("button", { name: GENERATE_BTN }).click();
      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });

      await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: DOWNLOAD_BTN }).click(),
      ]);
      await page.getByRole("button", { name: /ตกลง \(ปิดหน้าต่าง\)/ }).click();

      await expect(
        page.getByText("ทำรายการปรับโครงสร้างหนี้เสร็จสิ้น")
      ).toBeVisible({ timeout: 15000 });
    });

    test("หน้าเสร็จสิ้น → กดกลับหน้าเริ่มต้น → ไป consent", async ({ page }) => {
      await mockGeneratePdfSuccess(page);
      await openContract(page);

      await page.getByRole("button", { name: GENERATE_BTN }).click();
      await expect(page.getByText("พรีวิวเอกสาร")).toBeVisible({ timeout: 20000 });
      await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.getByRole("button", { name: DOWNLOAD_BTN }).click(),
      ]);
      await page.getByRole("button", { name: /ตกลง \(ปิดหน้าต่าง\)/ }).click();
      await expect(
        page.getByText("ทำรายการปรับโครงสร้างหนี้เสร็จสิ้น")
      ).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: /กลับสู่หน้าเริ่มต้นลงทะเบียน/ }).click();

      await expect(page).toHaveURL(/\/drrs\/consent/);
    });

    test("ระหว่างสร้างเอกสาร → แสดงสถานะกำลังสร้าง และปุ่มถูก disable", async ({ page }) => {
      await page.route("**/api/generate-pdf", async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            base64:
              "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKdHJhaWxlcgo8PAovUm9vdCAxIDAgUgo+PgolJUVPRgo=",
            fileName: "contract_test.pdf",
          }),
        });
      });

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(page.getByText("กำลังสร้างเอกสาร กรุณารอสักครู่...")).toBeVisible();
      await expect(page.getByRole("button", { name: /กำลังเตรียมเอกสาร/ })).toBeDisabled();
    });
  });

  // ===== ERROR CASES =====

  test.describe("Error Cases", () => {
    test("API ตอบ 500 → แจ้งว่าไม่สามารถสร้างเอกสารได้ และไม่เข้าโหมดพรีวิว", async ({
      page,
    }) => {
      await mockGeneratePdfFail(page);
      const dialogs = captureDialogs(page);

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 20000,
      });
      expect(dialogs[0]).toContain("ไม่สามารถสร้างเอกสารได้");
      await expect(page.getByText("พรีวิวเอกสาร")).toBeHidden();
    });

    test("API ตอบ success=false → แจ้ง error พร้อมข้อความจาก backend", async ({ page }) => {
      await page.route("**/api/generate-pdf", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            base64: null,
            message: "ไม่พบข้อมูลสัญญา",
          }),
        })
      );
      const dialogs = captureDialogs(page);

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 20000,
      });
      expect(dialogs[0]).toContain("ไม่พบข้อมูลสัญญา");
    });

    test("API ตอบ success=true แต่ไม่มีไฟล์ base64 → แจ้ง error", async ({ page }) => {
      await page.route("**/api/generate-pdf", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, base64: null }),
        })
      );
      const dialogs = captureDialogs(page);

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 20000,
      });
      expect(dialogs[0]).toContain("เซิร์ฟเวอร์ไม่ได้ส่งข้อมูลไฟล์ PDF กลับมา");
    });

    test("network error → แจ้ง error และยังอยู่หน้าเดิม", async ({ page }) => {
      await page.route("**/api/generate-pdf", (route) => route.abort("failed"));
      const dialogs = captureDialogs(page);

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(() => expect(dialogs.length).toBeGreaterThan(0)).toPass({
        timeout: 20000,
      });
      await expect(page.getByText("ระบบเอกสารอิเล็กทรอนิกส์")).toBeVisible();
    });

    test("สร้าง error แล้ว → กดสร้างใหม่ได้อีกครั้ง (ปุ่มไม่ค้าง disable)", async ({
      page,
    }) => {
      await mockGeneratePdfFail(page);
      captureDialogs(page);

      await openContract(page);
      await page.getByRole("button", { name: GENERATE_BTN }).click();

      await expect(page.getByRole("button", { name: GENERATE_BTN })).toBeEnabled({
        timeout: 20000,
      });
    });

    test("ไม่มี template ที่ส่งมา → หน้าไม่พัง (ยังกดสร้างเอกสารได้)", async ({ page }) => {
      const noTemplate = { ...contractState };
      delete noTemplate.template;

      await openContract(page, noTemplate);

      await expect(page.getByText("ระบบเอกสารอิเล็กทรอนิกส์")).toBeVisible();
      await expect(page.getByRole("button", { name: GENERATE_BTN })).toBeVisible();
    });
  });
});
