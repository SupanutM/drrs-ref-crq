// @ts-check
const { test, expect } = require("@playwright/test");
const {
  mockSystemOpen,
  mockEncrypt,
  mockVerifySuccess,
  mockVerifyFail,
  mockVerifyServerError,
} = require("./helpers/mock-api");
const { passConsentToForm } = require("./helpers/navigation");
const { fillIndividualForm, pickFullBirthDate, submitButton } = require("./helpers/form");
const { validIndividual, invalidData, formLabels, formErrors } = require("./helpers/test-data");

test.describe("หน้า FormRegister (ลงทะเบียน)", () => {
  test.beforeEach(async ({ page }) => {
    await mockSystemOpen(page);
    await mockEncrypt(page);
  });

  // ===== HAPPY PATH =====

  test.describe("Happy Path - บุคคลธรรมดา", () => {
    test("แสดงฟอร์มบุคคลธรรมดาเป็น default พร้อม input ครบทุกช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await expect(page.getByText("ลงทะเบียนขอปรับปรุงโครงสร้างหนี้")).toBeVisible();
      await expect(
        page.getByRole("radio", { name: "บุคคลธรรมดา", exact: true })
      ).toBeChecked();

      // input ต้องครบทุกช่อง
      await expect(page.getByLabel(formLabels.citizenId)).toBeVisible();
      await expect(page.getByLabel(formLabels.laserCardId)).toBeVisible();
      await expect(page.getByLabel(formLabels.name)).toBeVisible();
      await expect(page.getByLabel(formLabels.surname)).toBeVisible();
      await expect(page.getByLabel(formLabels.telNo)).toBeVisible();
      await expect(page.getByLabel(formLabels.email)).toBeVisible();
      await expect(page.getByLabel(formLabels.digitNo)).toBeVisible();
      await expect(submitButton(page)).toBeVisible();
    });

    test("เลือกวันเกิดแบบครบถ้วน → input แสดงวันเกิดเป็น พ.ศ.", async ({ page }) => {
      await passConsentToForm(page);
      await pickFullBirthDate(page);

      // CustomInput แสดงผลด้วย displayFormat "DD MMMM YYYY" (ปี พ.ศ.)
      await expect(page.getByLabel(formLabels.birthDateFull)).toHaveValue(/2530/);
    });

    test("กรอกข้อมูลถูกต้องครบถ้วน → verify สำเร็จ → เปิด modal ระบุข้อมูลรายได้", async ({
      page,
    }) => {
      await mockVerifySuccess(page);
      await passConsentToForm(page);

      await fillIndividualForm(page);

      // ไม่ควรมี error ค้างอยู่ ปุ่มต้องกดได้
      await expect(submitButton(page)).toBeEnabled();
      await submitButton(page).click();

      // verify สำเร็จ -> FormRegister เปิด IncomeModal
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("button", { name: "บันทึกรายได้" })).toBeVisible();
    });

    test("verify สำเร็จ → เก็บ session token ลง sessionStorage", async ({ page }) => {
      await mockVerifySuccess(page);
      await passConsentToForm(page);

      await fillIndividualForm(page);
      await submitButton(page).click();
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 15000 });

      const token = await page.evaluate(() =>
        sessionStorage.getItem("drrs_session_token")
      );
      expect(token).toBe("mock-jwt-token-for-testing");
    });

    test("อีเมลเป็นค่าว่างได้ (ไม่ required) → verify ผ่าน", async ({ page }) => {
      await mockVerifySuccess(page);
      await passConsentToForm(page);

      await fillIndividualForm(page, { email: "" });
      await expect(submitButton(page)).toBeEnabled();
      await submitButton(page).click();

      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeVisible({ timeout: 15000 });
    });

    test("เปลี่ยนเป็นนิติบุคคล → สลับไปฟอร์มนิติบุคคล", async ({ page }) => {
      await passConsentToForm(page);

      const juristicRadio = page.getByRole("radio", { name: "นิติบุคคล", exact: true });
      await juristicRadio.check();
      await expect(juristicRadio).toBeChecked();

      // ฟอร์มบุคคลธรรมดาต้องหายไป (เลขหลังบัตรประชาชนเป็นช่องเฉพาะบุคคลธรรมดา)
      await expect(page.getByLabel(formLabels.laserCardId)).toBeHidden();
    });
  });

  // ===== VALIDATION ERROR CASES =====

  test.describe("Validation Errors - บุคคลธรรมดา", () => {
    test("กดยืนยันโดยไม่กรอกข้อมูล → แจ้งเตือนให้กรอกครบถ้วน", async ({ page }) => {
      await passConsentToForm(page);

      await submitButton(page).click();

      await expect(page.getByText(formErrors.incomplete)).toBeVisible();
    });

    test("ไม่เลือกวันเกิด (ข้อมูลอื่นครบ) → แจ้งเตือนและไม่ยิง API", async ({ page }) => {
      let verifyCalled = false;
      await page.route("**/api/verify-register", (route) => {
        verifyCalled = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { targetInfo: {} } }),
        });
      });

      await passConsentToForm(page);
      await fillIndividualForm(page, {}, { skipBirthDate: true });
      await submitButton(page).click();

      await expect(page.getByText(formErrors.incomplete)).toBeVisible();
      expect(verifyCalled).toBe(false);
    });

    test("เลขบัตรประชาชนไม่ครบ 13 หลัก → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.citizenId).fill(invalidData.citizenIdShort);
      await page.getByLabel(formLabels.citizenId).blur();

      await expect(page.getByText(formErrors.citizenId)).toBeVisible();
    });

    test("เลขบัตรประชาชน 13 หลักแต่ checksum ผิด → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.citizenId).fill(invalidData.citizenIdBadChecksum);
      await page.getByLabel(formLabels.citizenId).blur();

      await expect(page.getByText(formErrors.citizenId)).toBeVisible();
    });

    test("เลขบัตรประชาชนถูกต้อง → ไม่แสดง error", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.citizenId).fill(validIndividual.citizenId);
      await page.getByLabel(formLabels.citizenId).blur();

      await expect(page.getByText(formErrors.citizenId)).toBeHidden();
    });

    test("เลขหลังบัตรประชาชนผิดรูปแบบ → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.laserCardId).fill(invalidData.laserCardIdBadFormat);
      await page.getByLabel(formLabels.laserCardId).blur();

      await expect(page.getByText(formErrors.laserCardId)).toBeVisible();
    });

    test("เลขหลังบัตรประชาชนไม่ครบ 12 หลัก → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.laserCardId).fill(invalidData.laserCardIdShort);
      await page.getByLabel(formLabels.laserCardId).blur();

      await expect(page.getByText(formErrors.laserCardId)).toBeVisible();
    });

    test("เลขหลังบัตรประชาชนพิมพ์ตัวเล็ก → ระบบแปลงเป็นตัวใหญ่ให้", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.laserCardId).fill("me1234567890");

      await expect(page.getByLabel(formLabels.laserCardId)).toHaveValue("ME1234567890");
      await expect(page.getByText(formErrors.laserCardId)).toBeHidden();
    });

    test("ชื่อมีตัวเลข → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.name).fill(invalidData.nameSpecialChar);
      await page.getByLabel(formLabels.name).blur();

      await expect(page.getByText(formErrors.name)).toBeVisible();
    });

    test("นามสกุลมีอักขระพิเศษ → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.surname).fill(invalidData.surnameSpecialChar);
      await page.getByLabel(formLabels.surname).blur();

      await expect(page.getByText(formErrors.surname)).toBeVisible();
    });

    test("เบอร์โทรไม่ครบ 10 หลัก → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.telNo).fill(invalidData.telNoShort);
      await page.getByLabel(formLabels.telNo).blur();

      await expect(page.getByText(formErrors.telNo)).toBeVisible();
    });

    test("อีเมลผิดรูปแบบ → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.email).fill(invalidData.emailInvalid);
      await page.getByLabel(formLabels.email).blur();

      await expect(page.getByText(formErrors.email)).toBeVisible();
    });

    test("รหัส 4 หลักไม่ครบ → แสดง error ใต้ช่อง", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.digitNo).fill(invalidData.digitNoShort);
      await page.getByLabel(formLabels.digitNo).blur();

      await expect(page.getByText(formErrors.digitNo)).toBeVisible();
    });

    test("รหัส 4 หลักพิมพ์ตัวอักษร → ระบบตัดออกให้ (เหลือค่าว่าง)", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.digitNo).fill("abcd");

      await expect(page.getByLabel(formLabels.digitNo)).toHaveValue("");
    });

    test("มี error ค้างอยู่ → ปุ่มยืนยันถูก disable", async ({ page }) => {
      await passConsentToForm(page);

      await page.getByLabel(formLabels.citizenId).fill(invalidData.citizenIdShort);
      await page.getByLabel(formLabels.citizenId).blur();

      await expect(submitButton(page)).toBeDisabled();
    });
  });

  // ===== API ERROR CASES =====

  test.describe("API Errors", () => {
    test("verify ตอบ success=false → แสดงข้อความจาก API", async ({ page }) => {
      await mockVerifyFail(page);
      await passConsentToForm(page);

      await fillIndividualForm(page);
      await submitButton(page).click();

      await expect(
        page.getByText("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง")
      ).toBeVisible({ timeout: 15000 });

      // ต้องไม่เปิด modal รายได้
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeHidden();
    });

    test("verify ตอบ 500 → แสดงข้อความ error และไม่ไปหน้าถัดไป", async ({ page }) => {
      await mockVerifyServerError(page);
      await passConsentToForm(page);

      await fillIndividualForm(page);
      await submitButton(page).click();

      // controller ดัก error แล้วแสดง alert (severity = error)
      await expect(page.locator(".MuiAlert-filledError")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("ระบุข้อมูลรายได้")).toBeHidden();
      await expect(page).toHaveURL(/\/drrs\/form/);
    });

    test("verify ล้มเหลว → ไม่เก็บ session token", async ({ page }) => {
      await mockVerifyFail(page);
      await passConsentToForm(page);

      await fillIndividualForm(page);
      await submitButton(page).click();
      await expect(
        page.getByText("ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง")
      ).toBeVisible({ timeout: 15000 });

      const token = await page.evaluate(() =>
        sessionStorage.getItem("drrs_session_token")
      );
      expect(token).toBeNull();
    });

    test("network error (API ล่ม) → แสดงข้อความ error", async ({ page }) => {
      await page.route("**/api/verify-register", (route) => route.abort("failed"));
      await passConsentToForm(page);

      await fillIndividualForm(page);
      await submitButton(page).click();

      await expect(page.locator(".MuiAlert-filledError")).toBeVisible({ timeout: 15000 });
    });
  });

  // ===== ACCESS CONTROL =====

  test.describe("Access Control", () => {
    test("เข้าหน้า /drrs/form โดยตรง (ไม่ผ่าน consent) → เด้งกลับ consent", async ({
      page,
    }) => {
      await page.goto("/drrs/form");
      await expect(page).toHaveURL(/\/drrs\/consent/);
    });
  });
});
