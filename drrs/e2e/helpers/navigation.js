// Helper: navigation utilities สำหรับ E2E tests
const { validIndividual } = require("./test-data");
const { fillIndividualForm, submitButton } = require("./form");

/**
 * ไปหน้า Consent และรอโหลดเสร็จ
 */
async function goToConsent(page) {
  await page.goto("/drrs/consent");
  await page.waitForLoadState("networkidle");
}

/**
 * ผ่านหน้า Consent แล้วไปหน้า FormRegister (ติ๊ก checkbox + กดยอมรับ)
 */
async function passConsentToForm(page) {
  await goToConsent(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ยอมรับ" }).click();
  await page.waitForURL("**/drrs/form**");
}

/**
 * เดินตาม flow จริงจนถึงหน้า plan-preview
 * consent -> form -> verify -> IncomeModal -> plan-preview
 * ต้อง mock verify + encrypt + update-income ไว้ก่อนเรียก
 */
async function goThroughFormToPlanPreview(page, income = { totalIncome: "30000", totalCost: "10000" }) {
  await passConsentToForm(page);
  await fillIndividualForm(page);
  await submitButton(page).click();

  // IncomeModal เปิดหลัง verify สำเร็จ
  await page.getByLabel("ระบุรายได้รวม").waitFor({ state: "visible", timeout: 20000 });
  await page.getByLabel("ระบุรายได้รวม").fill(income.totalIncome);
  await page.getByLabel("ระบุค่าใช้จ่ายรวม").fill(income.totalCost);
  await page.getByRole("button", { name: "บันทึกรายได้" }).click();

  await page.waitForURL("**/drrs/plan-preview**", { timeout: 20000 });
}

/**
 * เดินตาม flow จริงจนถึงหน้า select-plan
 */
async function goThroughToSelectPlan(page, income) {
  await goThroughFormToPlanPreview(page, income);
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await page.waitForURL("**/drrs/select-plan**", { timeout: 20000 });
}

/**
 * Set session token ใน sessionStorage
 */
async function setSessionToken(page, token = "mock-jwt-token-for-testing") {
  await page.evaluate((t) => {
    sessionStorage.setItem("drrs_session_token", t);
  }, token);
}

/**
 * เปิดหน้าที่ต้องมี router state โดยยัด state เข้า history ตรงๆ
 *
 * ใช้สำหรับ route ที่ flow ปัจจุบันไม่มีปุ่มพาไป (เช่น /drrs/plan, /drrs/plan-detail,
 * /drrs/contract) แต่ยังเป็นหน้าที่ใช้งานได้จริงและต้องถูกทดสอบ
 *
 * react-router v6 อ่าน location.state จาก window.history.state.usr
 * (ดู createBrowserHistory: state.usr / state.key / state.idx)
 * ถ้า react-router เปลี่ยน internal shape เทสต์จะพังที่จุดนี้จุดเดียว
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} path เช่น "/drrs/plan"
 * @param {object} state ค่าที่ต้องการให้ useLocation().state คืน
 */
async function gotoWithRouterState(page, path, state) {
  // ต้องให้ app โหลดอยู่ก่อน แล้วค่อยสลับ route ผ่าน history
  if (!page.url().includes("/drrs/")) {
    await goToConsent(page);
  }

  await page.evaluate(
    ({ path, state }) => {
      window.history.pushState(
        { usr: state, key: "e2e-injected", idx: (window.history.state?.idx ?? 0) + 1 },
        "",
        path
      );
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    },
    { path, state }
  );
}

module.exports = {
  goToConsent,
  passConsentToForm,
  goThroughFormToPlanPreview,
  goThroughToSelectPlan,
  setSessionToken,
  gotoWithRouterState,
  validIndividual,
};
