// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockSaveDebtSuccess,
  mockSaveDebtFail,
} = require("./helpers/mock-api");
const { goToConsent, gotoWithRouterState } = require("./helpers/navigation");
const { mockRouterState } = require("./helpers/test-data");

const HC_PLAN = {
  planNo: "01",
  planName: "Haircut",
  planDesc: "กรณีปิดบัญชี(Haircut)",
  loanType: "HC",
};
const LT_PLAN = {
  planNo: "02",
  planName: "Installment Terms",
  planDesc: "กรณีผ่อนชำระ",
  loanType: "LT",
};

const ACCEPT_HC = /ยอมรับข้อเสนอ \(ปิดยอด\)/;
const ACCEPT_LT = /ยอมรับข้อเสนอ \(ผ่อนชำระ\)/;
const WARN_TITLE = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";

/** state ที่หน้า /drrs/plan-detail ต้องได้รับ (ปกติมาจาก LoanPlan) */
function detailState(selectedPlan, overrides = {}) {
  return { ...mockRouterState, ...overrides, selectedPlan };
}

async function openDetail(page, selectedPlan, overrides) {
  await goToConsent(page);
  await gotoWithRouterState(page, "/drrs/plan-detail", detailState(selectedPlan, overrides));
}

/** ดัก payload ที่ส่งไป /api/debt-restructure แล้วตอบสำเร็จ */
function captureSave(page, response = { success: true, template: { conditionMonth: "กันยายน", conditionYear: "2569", items: [] } }) {
  /** @type {{ body: any }} */
  const captured = { body: null };
  page.route("**/api/debt-restructure", (route) => {
    captured.body = route.request().postDataJSON();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return captured;
}

test.describe("หน้า LoanPlanDetails (รายละเอียดแผน + บันทึก)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
  });

  // ===== ACCESS CONTROL =====

  test.describe("Access Control", () => {
    test("มี state แต่ไม่มี selectedPlan → เด้งออกจากหน้า plan-detail", async ({ page }) => {
      await goToConsent(page);
      await gotoWithRouterState(page, "/drrs/plan-detail", mockRouterState);

      await expect(page).not.toHaveURL(/\/drrs\/plan-detail/);
    });
  });

  // ===== HAIRCUT =====

  test.describe("แผน Haircut (ปิดบัญชี)", () => {
    test("แสดงหน้า Haircut พร้อมรหัสแผน ชื่อแผน และปุ่มปิดยอด", async ({ page }) => {
      await openDetail(page, HC_PLAN);

      await expect(page.getByText("รายละเอียดแผนการชำระหนี้")).toBeVisible();
      await expect(page.getByText("Haircut Plan ✂️")).toBeVisible();
      await expect(page.getByText("แผนที่ 01 : Haircut")).toBeVisible();
      await expect(
        page.getByText("โปรดตรวจสอบข้อมูลและยอดชำระให้ถูกต้องก่อนทำการยืนยัน")
      ).toBeVisible();
      await expect(page.getByRole("button", { name: ACCEPT_HC })).toBeEnabled();
    });

    test("กดยอมรับ → ส่ง loantype HC และ planNo ที่เลือกไปบันทึก", async ({ page }) => {
      const captured = captureSave(page);
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await expect(
        page.getByText("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !")
          .or(page.getByText("บันทึกข้อมูลแผนการปรับปรุงโครงสร้างหนี้สำเร็จ!"))
      ).toBeVisible({ timeout: 15000 });

      expect(captured.body).toMatchObject({
        cusTargetId: "CUS001",
        loantype: "HC",
        planNo: "01",
      });
    });

    test("payload ของ Haircut ยังเป็นค่า hardcode (amount 500) ไม่ได้มาจากแผนที่เลือก", async ({
      page,
    }) => {
      // บันทึกพฤติกรรมปัจจุบัน: HaircutPlanController ส่ง planDetail.amount = 500 ตายตัว
      // ไม่ได้อ่านยอดจริงจากแผน ถ้าวันหลังแก้ให้ใช้ยอดจริง เทสต์นี้จะฟ้องให้มาปรับ
      const captured = captureSave(page);
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      expect(captured.body.planDetail).toEqual({ amount: 500 });
    });

    test("บันทึกสำเร็จ → กดดำเนินการต่อ → ไปหน้า contract", async ({ page }) => {
      await mockSaveDebtSuccess(page);
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();

      await expect(page).toHaveURL(/\/drrs\/contract/, { timeout: 20000 });
      await expect(page.getByText("ระบบเอกสารอิเล็กทรอนิกส์")).toBeVisible();
    });

    test("modal ระบุข้อมูลการชำระเงินเปิดไม่ได้เลย (UI ที่ไม่ถูกเรียกใช้)", async ({
      page,
    }) => {
      // HaircutPlanController มีแต่ setIsModalOpen(false) ไม่มีที่ไหนสั่งเปิด
      // ทำให้ dropdown "ช่องทางการชำระเงิน" เข้าถึงไม่ได้ และไม่ถูกส่งไปกับ payload
      const captured = captureSave(page);
      await openDetail(page, HC_PLAN);

      await expect(page.getByText("ระบุข้อมูลการชำระเงิน")).toBeHidden();

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      // ไม่มีข้อมูลช่องทางชำระเงินติดไปกับ payload
      expect(Object.keys(captured.body)).not.toContain("paymentMethod");
    });
  });

  // ===== INSTALLMENT =====

  test.describe("แผนผ่อนชำระ (Installment)", () => {
    test("แสดงหน้า Installment พร้อมรหัสแผน ชื่อแผน และปุ่มผ่อนชำระ", async ({ page }) => {
      await openDetail(page, LT_PLAN);

      await expect(page.getByText("Installment Plan 🗓️")).toBeVisible();
      await expect(page.getByText("แผนที่ 02 : Installment Terms")).toBeVisible();
      await expect(page.getByRole("button", { name: ACCEPT_LT })).toBeEnabled();
    });

    test("กดยอมรับ → ส่ง loantype LT และ planNo ที่เลือกไปบันทึก", async ({ page }) => {
      const captured = captureSave(page);
      await openDetail(page, LT_PLAN);

      await page.getByRole("button", { name: ACCEPT_LT }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      expect(captured.body).toMatchObject({
        cusTargetId: "CUS001",
        loantype: "LT",
        planNo: "02",
      });
    });

    test("payload ของผ่อนชำระยังเป็นค่า hardcode ไม่ได้มาจากแผนที่เลือก", async ({ page }) => {
      // บันทึกพฤติกรรมปัจจุบัน: InstallmentPlanController ส่งค่าตายตัวทั้งชุด
      // (แผนจริงในระบบคือ ผ่อน 3,000 x 12 งวด แต่ที่ส่งไปคือ 500 x 20 งวด)
      const captured = captureSave(page);
      await openDetail(page, LT_PLAN);

      await page.getByRole("button", { name: ACCEPT_LT }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      expect(captured.body.planDetail).toEqual({
        principal: 10000,
        installmentAmount: 500,
        interest: 2,
        installmentTerm: 20,
        installmentFrequency: 30,
      });
    });

    test("บันทึกสำเร็จ → กดดำเนินการต่อ → ไปหน้า contract", async ({ page }) => {
      await mockSaveDebtSuccess(page);
      await openDetail(page, LT_PLAN);

      await page.getByRole("button", { name: ACCEPT_LT }).click();
      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();

      await expect(page).toHaveURL(/\/drrs\/contract/, { timeout: 20000 });
    });
  });

  // ===== ACCOUNT NO (known defect) =====

  test.describe("การส่งเลขบัญชี", () => {
    test("targetInfo แบบจริง (มี accounts[] ไม่มี accountNo) → ส่ง accountNo ไม่ไป", async ({
      page,
    }) => {
      // verify ตัวจริงคืน targetInfo.accounts[] และไม่มี field accountNo
      // แต่ทั้ง 2 controller อ่าน routerState.targetInfo.accountNo ตรงๆ
      // ผลคือ accountNo หลุดหายไปจาก payload — เป็นบั๊กของเส้นทางนี้
      const realShape = {
        ...mockRouterState.targetInfo,
        accountNo: undefined,
      };
      delete realShape.accountNo;

      const captured = captureSave(page);
      await openDetail(page, HC_PLAN, { targetInfo: realShape });

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      expect(captured.body.accountNo).toBeUndefined();
    });

    test("ถ้า targetInfo มี accountNo → ส่งเลขบัญชีไปถูกต้อง", async ({ page }) => {
      const captured = captureSave(page);
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible({
        timeout: 15000,
      });

      expect(captured.body.accountNo).toBe("ACC001");
    });
  });

  // ===== ERROR CASES =====

  test.describe("Error Cases", () => {
    test("API ตอบ success=false → แสดง modal แจ้งข้อผิดพลาดพร้อมข้อความจาก API", async ({
      page,
    }) => {
      await mockSaveDebtFail(page);
      await openDetail(page, LT_PLAN);

      await page.getByRole("button", { name: ACCEPT_LT }).click();

      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง")
      ).toBeVisible();
      await expect(page).toHaveURL(/\/drrs\/plan-detail/);
    });

    test("API ตอบ 500 → แสดง modal แจ้งข้อผิดพลาดจาก backend", async ({ page }) => {
      await page.route("**/api/debt-restructure", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้" }),
        })
      );
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();

      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้")
      ).toBeVisible();
    });

    test("network error → แสดง modal แจ้งข้อผิดพลาด", async ({ page }) => {
      await page.route("**/api/debt-restructure", (route) => route.abort("failed"));
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();

      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });
    });

    test("กดตกลงใน modal แจ้งข้อผิดพลาด → ปิด modal และยังอยู่หน้าเดิม", async ({ page }) => {
      await mockSaveDebtFail(page);
      await openDetail(page, LT_PLAN);

      await page.getByRole("button", { name: ACCEPT_LT }).click();
      await expect(page.getByText(WARN_TITLE)).toBeVisible({ timeout: 15000 });

      await page.getByRole("button", { name: "ตกลง" }).click();

      await expect(page.getByText(WARN_TITLE)).toBeHidden();
      await expect(page).toHaveURL(/\/drrs\/plan-detail/);
      // กดยอมรับซ้ำได้อีกครั้ง
      await expect(page.getByRole("button", { name: ACCEPT_LT })).toBeEnabled();
    });

    test("ระหว่างบันทึก → ปุ่มยอมรับถูก disable กันกดซ้ำ", async ({ page }) => {
      await page.route("**/api/debt-restructure", async (route) => {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            template: { conditionMonth: "กันยายน", conditionYear: "2569", items: [] },
          }),
        });
      });
      await openDetail(page, HC_PLAN);

      await page.getByRole("button", { name: ACCEPT_HC }).click();

      await expect(page.getByRole("button", { name: ACCEPT_HC })).toBeDisabled();
    });
  });
});
