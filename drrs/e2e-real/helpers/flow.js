/**
 * helper เดิน flow จริงบน backend จริง (ไม่ mock API เลย)
 *
 * ข้อมูลที่ใช้ล็อกอินมาจาก drrs/.env.e2e (gitignore) ผ่าน getTestIdentity()
 * ส่วนเลขบัตร/เลขหลังบัตร/วันเกิด ใช้ค่าสมมุติที่ "รูปแบบถูก" ได้
 * เพราะ backend เปิด LOAD_TEST_MODE ไว้ จึงข้ามการตรวจกับ DOPA
 */
const { getTestIdentity } = require("./db");

// นำ helper กรอกฟอร์มจากชุดเทสต์ mock มาใช้ซ้ำ (locator ชุดเดียวกัน)
const {
  fillIndividualForm,
  submitButton,
} = require("../../e2e/helpers/form");

const INCOME_LABEL = "ระบุรายได้รวม";
const OTHER_INCOME_LABEL = "ระบุรายได้อื่น";
const COST_LABEL = "ระบุค่าใช้จ่ายรวม";

/** ข้อมูลกรอกฟอร์มที่ผูกกับลูกค้าจริงใน DB */
function realFormData() {
  const identity = getTestIdentity();
  return {
    // ค่าสมมุติที่รูปแบบถูกต้อง (ไม่ถูกตรวจกับ DOPA เพราะ LOAD_TEST_MODE)
    citizenId: "1101201567898",
    laserCardId: "ME1234567890",
    telNo: "0812345678",
    email: "e2e-real@example.com",
    // ค่าที่ต้องตรงกับ tbl_cus_target จริง
    name: identity.firstName,
    surname: identity.lastName,
    digitNo: identity.verifyCode,
    birthDate: { beYear: "2540", month: "มกราคม", day: "01" },
  };
}

/** หน้า consent -> ติ๊กยอมรับ -> หน้าฟอร์ม */
async function passConsentToForm(page) {
  await page.goto("/drrs/consent");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ยอมรับ" }).click();
  await page.waitForURL("**/drrs/form**");
}

/**
 * ยืนยันตัวตนด้วย backend จริง
 * @param {object} page
 * @param {object} overrides ค่าที่อยากเขียนทับ (ใช้ทดสอบเคสข้อมูลผิด)
 */
async function verifyThroughForm(page, overrides = {}) {
  await passConsentToForm(page);
  await fillIndividualForm(page, { ...realFormData(), ...overrides });
  await submitButton(page).click();
}

/**
 * กรอกรายได้ใน modal แล้วบันทึก -> ไปหน้า plan-preview
 *
 * ต้องกรอก "รายได้อื่น" ด้วยทุกครั้ง เพราะ modal เติมค่าเดิมจากฐานข้อมูลมาให้
 * ถ้าไม่เขียนทับ รายได้สุทธิจะรวมค่าเก่าเข้าไปโดยไม่รู้ตัว
 */
async function fillIncome(
  page,
  { totalIncome = "50000", otherIncome = "0", totalCost = "5000" } = {}
) {
  await page.getByLabel(INCOME_LABEL).waitFor({ state: "visible", timeout: 45000 });
  await page.getByLabel(INCOME_LABEL).fill(totalIncome);
  await page.getByLabel(OTHER_INCOME_LABEL).fill(otherIncome);
  await page.getByLabel(COST_LABEL).fill(totalCost);
  await page.getByRole("button", { name: "บันทึกรายได้" }).click();
  await page.waitForURL("**/drrs/plan-preview**", { timeout: 45000 });
}

/**
 * การ์ดแผนของ "บัญชีใบที่ระบุ" (หน้า select-plan แสดงหลายบัญชี ชื่อแผนซ้ำกันได้)
 *
 * ผูกกับ radio ที่ตั้ง name = `radio-plan-<accountNo>` และ value = planNo
 * จึงชี้การ์ดได้แม่นแม้จะมีบัญชีหลายใบบนหน้าเดียว
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} accountNo
 * @param {string} planNo "01" = ปิดบัญชี (HC), "02" = ผ่อนชำระ (LT)
 */
function planCard(page, accountNo, planNo) {
  // .MuiCard-root ชนกับ Card ตัวนอกของหน้าด้วย (Card ครอบทั้งหน้า) จึงเอาตัวในสุด
  return page
    .locator(".MuiCard-root")
    .filter({
      has: page.locator(`input[name="radio-plan-${accountNo}"][value="${planNo}"]`),
    })
    .last();
}

/**
 * radio ของแผนนั้นๆ — ใช้ทั้งคลิกเลือกและตรวจสถานะ
 * ชี้ได้ตัวเดียวแน่นอน เพราะ name ผูกกับเลขบัญชีและ value คือรหัสแผน
 */
function planRadio(page, accountNo, planNo) {
  return page.locator(`input[name="radio-plan-${accountNo}"][value="${planNo}"]`);
}

/** เลือกแผนของบัญชีที่ระบุ (คลิกที่ radio ตรงๆ กันชนกับ element อื่น) */
async function selectPlan(page, accountNo, planNo) {
  await planRadio(page, accountNo, planNo).click();
}

/** หัวข้อบัญชีในหน้า select-plan เช่น "4. บัญชีเลขที่ 000...004" */
function accountHeading(page, accountNo) {
  return page.getByRole("heading", {
    name: new RegExp(`^\\d+\\.\\s*บัญชีเลขที่\\s*${accountNo}`),
  });
}

/** เดินจนถึงหน้า select-plan ด้วย backend จริง */
async function goToSelectPlan(page, income) {
  await verifyThroughForm(page);
  await fillIncome(page, income);
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await page.waitForURL("**/drrs/select-plan**", { timeout: 45000 });
}

module.exports = {
  realFormData,
  passConsentToForm,
  verifyThroughForm,
  fillIncome,
  goToSelectPlan,
  planCard,
  planRadio,
  selectPlan,
  accountHeading,
  submitButton,
  INCOME_LABEL,
  OTHER_INCOME_LABEL,
  COST_LABEL,
};
