// @ts-check
/**
 * E2E กับ backend จริง + PostgreSQL จริง (ไม่ mock API เลย)
 *
 * ต้องเปิดไว้ก่อนรัน:
 *   cd drrs-api && npm run dev     (backend :5000)
 *   cd drrs && npm run dev         (frontend :3000)
 *
 * ทุกเทสต์ reset สถานะ DB ก่อนเริ่ม (จาก snapshot ที่ global-setup ทำไว้)
 * และ global-teardown จะคืนค่าทั้งหมดตอนจบ
 */
const { test, expect } = require("@playwright/test");
const {
  SCHEMA,
  query,
  getTestIdentity,
  restoreMutableState,
} = require("./helpers/db");
const {
  verifyThroughForm,
  fillIncome,
  goToSelectPlan,
  planRadio,
  selectPlan,
  accountHeading,
} = require("./helpers/flow");

const identity = getTestIdentity();

/** เลขบัญชีที่ยังไม่ได้ลงทะเบียน (เลือกได้) */
const TARGET_ACCOUNT = identity.accountNo;

/** รหัสแผนใน tbl_mt_master_plan */
const PLAN_HAIRCUT = "01";
const PLAN_INSTALLMENT = "02";

const SUCCESS_MSG = "บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !";

/** เลือกแผนของบัญชีเป้าหมาย แล้วกดยืนยัน */
async function choosePlanAndConfirm(page, planNo) {
  await selectPlan(page, TARGET_ACCOUNT, planNo);
  await page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" }).click();
  await expect(page.getByText(SUCCESS_MSG)).toBeVisible({ timeout: 60000 });
}

test.describe("DRRS flow กับ backend จริง", () => {
  test.beforeEach(async () => {
    // ให้ทุกเทสต์เริ่มจากสถานะ DB เดียวกัน
    await restoreMutableState();
  });

  // ===== 1. ระบบเปิด/ปิด (อ่านจาก tbl_settings_app จริง) =====

  test("หน้า consent อ่านสถานะระบบจาก backend จริง แล้วแสดงข้อตกลง", async ({ page }) => {
    await page.goto("/drrs/consent");

    await expect(
      page.getByRole("heading", { name: "ข้อตกลงในการลงทะเบียน" })
    ).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
  });

  // ===== 2. ยืนยันตัวตน (verify จริง + เข้ารหัสจริง + ข้าม DOPA ด้วย LOAD_TEST_MODE) =====

  test.describe("ยืนยันตัวตน", () => {
    test("ข้อมูลตรงกับฐานข้อมูล → ผ่าน และเปิด modal ระบุรายได้", async ({ page }) => {
      await verifyThroughForm(page);

      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 45000 });
    });

    test("verify สำเร็จ → ได้ session token เป็น JWT จริงจาก backend", async ({ page }) => {
      await verifyThroughForm(page);
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 45000 });

      const token = await page.evaluate(() =>
        sessionStorage.getItem("drrs_session_token")
      );
      expect(token).toBeTruthy();
      // JWT = 3 ส่วนคั่นด้วยจุด
      expect(String(token).split(".")).toHaveLength(3);
    });

    test("รหัส 4 หลักผิด → backend ตอบว่าไม่พบข้อมูลลูกค้า", async ({ page }) => {
      await verifyThroughForm(page, { digitNo: "9999" });

      await expect(
        page.getByText("ไม่พบข้อมูลลูกค้า หรือรหัสยืนยันไม่ถูกต้อง")
      ).toBeVisible({ timeout: 45000 });
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeHidden();
    });

    test("ชื่อ-นามสกุลไม่ตรง → backend ตอบว่าไม่พบข้อมูลลูกค้า", async ({ page }) => {
      await verifyThroughForm(page, { name: "ไม่มีชื่อนี้", surname: "ไม่มีนามสกุลนี้" });

      await expect(
        page.getByText("ไม่พบข้อมูลลูกค้า หรือรหัสยืนยันไม่ถูกต้อง")
      ).toBeVisible({ timeout: 45000 });
    });

    test("verify ล้มเหลว → ไม่ได้ session token", async ({ page }) => {
      await verifyThroughForm(page, { digitNo: "9999" });
      await expect(
        page.getByText("ไม่พบข้อมูลลูกค้า หรือรหัสยืนยันไม่ถูกต้อง")
      ).toBeVisible({ timeout: 45000 });

      const token = await page.evaluate(() =>
        sessionStorage.getItem("drrs_session_token")
      );
      expect(token).toBeNull();
    });

    test("verify สำเร็จ → DB บันทึกขั้นตอน verify ครบทุกบัญชี", async ({ page }) => {
      await verifyThroughForm(page);
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 45000 });

      const rows = await query(
        `SELECT account_no, step_verify_target, step_verify_laser
           FROM ${SCHEMA}.tbl_settings_step
          WHERE account_no = $1`,
        [TARGET_ACCOUNT]
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].step_verify_target.trim()).toBe("1");
      expect(rows[0].step_verify_laser.trim()).toBe("1");
    });
  });

  // ===== 3. บันทึกรายได้ (update-income จริง) =====

  test.describe("บันทึกรายได้", () => {
    test("กรอกรายได้ → DB อัปเดตรายได้และคำนวณรายได้สุทธิถูกต้อง", async ({ page }) => {
      await verifyThroughForm(page);
      await fillIncome(page, {
        totalIncome: "60000",
        otherIncome: "0",
        totalCost: "10000",
      });

      const rows = await query(
        `SELECT total_income, other_income, total_cost, net_income
           FROM ${SCHEMA}.tbl_cus_target
          WHERE first_name = $1 AND last_name = $2`,
        [identity.firstName, identity.lastName]
      );

      expect(rows).toHaveLength(1);
      expect(Number(rows[0].total_income)).toBe(60000);
      expect(Number(rows[0].total_cost)).toBe(10000);
      // รายได้สุทธิ = รายได้รวม + รายได้อื่น - ค่าใช้จ่ายรวม
      expect(Number(rows[0].net_income)).toBe(50000);
    });

    test("มีรายได้อื่น → รายได้สุทธิรวมรายได้อื่นเข้าไปด้วย", async ({ page }) => {
      await verifyThroughForm(page);
      await fillIncome(page, {
        totalIncome: "60000",
        otherIncome: "4000",
        totalCost: "10000",
      });

      const rows = await query(
        `SELECT other_income, net_income FROM ${SCHEMA}.tbl_cus_target
          WHERE first_name = $1 AND last_name = $2`,
        [identity.firstName, identity.lastName]
      );

      expect(Number(rows[0].other_income)).toBe(4000);
      expect(Number(rows[0].net_income)).toBe(54000);
    });

    test("บันทึกรายได้แล้ว → ไปหน้า plan-preview", async ({ page }) => {
      await verifyThroughForm(page);
      await fillIncome(page);

      await expect(page).toHaveURL(/\/drrs\/plan-preview/);
      await expect(page.getByRole("button", { name: "ดำเนินการต่อ" })).toBeVisible();
    });
  });

  // ===== 4. เลือกแผน (ข้อมูลแผนจาก DB จริง) =====

  test.describe("เลือกแผนการชำระหนี้", () => {
    test("หน้า select-plan แสดงบัญชีและแผนที่มาจากฐานข้อมูลจริง", async ({ page }) => {
      await goToSelectPlan(page);

      await expect(
        page.getByRole("heading", { name: "เลือกแผนการชำระหนี้" })
      ).toBeVisible();
      await expect(accountHeading(page, TARGET_ACCOUNT)).toBeVisible();
      // บัญชีเป้าหมายต้องมีทั้งแผนปิดบัญชีและแผนผ่อนชำระให้เลือก
      await expect(planRadio(page, TARGET_ACCOUNT, PLAN_HAIRCUT)).toBeVisible();
      await expect(planRadio(page, TARGET_ACCOUNT, PLAN_INSTALLMENT)).toBeVisible();
    });

    test("บัญชีที่ลงทะเบียนไปแล้วถูกล็อก เลือกไม่ได้", async ({ page }) => {
      // ใน DB ชุดนี้มีบัญชีที่ step_confirm_plan = '1' อยู่แล้ว
      const registered = await query(
        `SELECT account_no FROM ${SCHEMA}.tbl_settings_step
          WHERE TRIM(step_confirm_plan) = '1'`
      );
      test.skip(registered.length === 0, "ไม่มีบัญชีที่ลงทะเบียนแล้วใน DB ชุดนี้");

      await goToSelectPlan(page);

      await expect(
        page.getByText("(บัญชีนี้ได้ทำการเลือกลงทะเบียนไปแล้ว)").first()
      ).toBeVisible();
    });

    test("บัญชีที่ยังไม่ลงทะเบียน → เลือกแผนได้ และปุ่มยืนยันเปิดใช้งาน", async ({ page }) => {
      await goToSelectPlan(page);

      const confirm = page.getByRole("button", { name: "ยืนยันแผนการชำระหนี้" });
      await expect(confirm).toBeDisabled();

      await selectPlan(page, TARGET_ACCOUNT, PLAN_INSTALLMENT);

      await expect(planRadio(page, TARGET_ACCOUNT, PLAN_INSTALLMENT)).toBeChecked();
      await expect(confirm).toBeEnabled();
    });
  });

  // ===== 5. บันทึกแผนลงฐานข้อมูลจริง =====

  test.describe("บันทึกแผนลงฐานข้อมูล", () => {
    test("เลือกแผนผ่อนชำระ → บันทึกสำเร็จ และมีข้อมูลจริงในตารางผ่อนชำระ", async ({
      page,
    }) => {
      await goToSelectPlan(page);
      await choosePlanAndConfirm(page, PLAN_INSTALLMENT);

      const rows = await query(
        `SELECT account_no, installment_amount, installment_term, status
           FROM ${SCHEMA}.tbl_account_installment
          WHERE account_no = $1 AND status = '1'
          ORDER BY id DESC`,
        [TARGET_ACCOUNT]
      );

      expect(rows.length).toBeGreaterThan(0);
      // ยอดผ่อนและจำนวนงวดต้องตรงกับแผนที่ตั้งไว้ใน tbl_account_cus_target
      const plan = await query(
        `SELECT payment_amount, installment_terms
           FROM ${SCHEMA}.tbl_account_cus_target
          WHERE account_no = $1 AND plan_no = '02'`,
        [TARGET_ACCOUNT]
      );
      expect(Number(rows[0].installment_amount)).toBe(Number(plan[0].payment_amount));
      expect(Number(rows[0].installment_term)).toBe(Number(plan[0].installment_terms));
    });

    test("เลือกแผนปิดบัญชี → บันทึกสำเร็จ และยอดปิดบัญชีตรงกับแผนในฐานข้อมูล", async ({
      page,
    }) => {
      await goToSelectPlan(page);
      await choosePlanAndConfirm(page, PLAN_HAIRCUT);

      const rows = await query(
        `SELECT account_no, plan_no, amount, status
           FROM ${SCHEMA}.tbl_account_hair_cut
          WHERE account_no = $1 AND status = '1'
          ORDER BY id DESC`,
        [TARGET_ACCOUNT]
      );

      expect(rows.length).toBeGreaterThan(0);
      const plan = await query(
        `SELECT payment_amount FROM ${SCHEMA}.tbl_account_cus_target
          WHERE account_no = $1 AND plan_no = '01'`,
        [TARGET_ACCOUNT]
      );
      expect(Number(rows[0].amount)).toBe(Number(plan[0].payment_amount));
    });

    test("บันทึกแผนแล้ว → DB บันทึกขั้นตอนยืนยันแผน", async ({ page }) => {
      await goToSelectPlan(page);
      await choosePlanAndConfirm(page, PLAN_INSTALLMENT);

      const rows = await query(
        `SELECT step_confirm_plan FROM ${SCHEMA}.tbl_settings_step
          WHERE account_no = $1`,
        [TARGET_ACCOUNT]
      );
      expect(rows[0].step_confirm_plan.trim()).toBe("1");
    });
  });

  // ===== 6. หน้าสรุปแผน + สัญญาจริง =====

  test.describe("สรุปแผนและสัญญา", () => {
    test("บันทึกแผนแล้วกดต่อ → ถึงหน้าสรุปแผน และโหลดเนื้อหาสัญญาจาก backend จริงได้", async ({
      page,
    }) => {
      await goToSelectPlan(page);
      await choosePlanAndConfirm(page, PLAN_INSTALLMENT);

      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
      await expect(page).toHaveURL(/\/drrs\/plan-summary/, { timeout: 60000 });

      await expect(page.getByText("สรุปแผนการชำระหนี้")).toBeVisible();
      // ต้องโหลดสัญญาได้ ไม่ใช่ขึ้นข้อความ error
      await expect(page.getByText("กำลังโหลดข้อมูลสัญญา...")).toBeHidden({
        timeout: 60000,
      });
      await expect(
        page.getByText("ไม่สามารถโหลดข้อมูลสัญญากรุณาลองใหม่อีกครั้ง")
      ).toBeHidden();
    });

    test("กดยอมรับแล้วดาวน์โหลด → ได้ไฟล์สัญญา PDF จริงจาก backend", async ({ page }) => {
      await goToSelectPlan(page);
      await choosePlanAndConfirm(page, PLAN_INSTALLMENT);
      await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
      await expect(page).toHaveURL(/\/drrs\/plan-summary/, { timeout: 60000 });
      await expect(page.getByText("กำลังโหลดข้อมูลสัญญา...")).toBeHidden({
        timeout: 60000,
      });

      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "ยอมรับ" }).click();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 90000 }),
        page.getByRole("button", { name: "ดาวน์โหลด" }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      const stream = await download.createReadStream();
      let size = 0;
      for await (const chunk of stream) size += chunk.length;
      // ไฟล์สัญญาจริงต้องไม่ใช่ไฟล์เปล่า
      expect(size).toBeGreaterThan(1000);
    });
  });

  // ===== 7. ยกเลิกแผน (cancel-plan จริง) =====

  test("กดยกเลิกที่หน้าสรุปแผน → backend ยกเลิกแผนที่บันทึกไว้", async ({ page }) => {
    await goToSelectPlan(page);
    await choosePlanAndConfirm(page, PLAN_INSTALLMENT);
    await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
    await expect(page).toHaveURL(/\/drrs\/plan-summary/, { timeout: 60000 });

    await page.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(page).toHaveURL(/\/drrs\/consent/, { timeout: 60000 });

    // แผนที่เพิ่งบันทึกต้องไม่เหลือสถานะใช้งาน
    const active = await query(
      `SELECT id FROM ${SCHEMA}.tbl_account_installment
        WHERE account_no = $1 AND status = '1'`,
      [TARGET_ACCOUNT]
    );
    expect(active).toHaveLength(0);
  });
});
