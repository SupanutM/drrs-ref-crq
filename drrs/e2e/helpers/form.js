// Helper: กรอกฟอร์มบุคคลธรรมดา (FormRegister)
const { formLabels, validIndividual } = require("./test-data");

/**
 * เลือกวันเกิดแบบครบถ้วน (วัน/เดือน/ปี)
 * DatePickerCustoms ใช้ input แบบ readOnly ต้องคลิกเปิดปฏิทินแล้วเลือก
 * ปฏิทินเปิดแบบ withPortal และแสดงปีเป็น พ.ศ. (renderYearContent / option + 543)
 */
async function pickFullBirthDate(page, { beYear, month, day } = validIndividual.birthDate) {
  // 1. เลือกประเภท "มีข้อมูลครบถ้วนทั้ง วัน/เดือน/ปี"
  await page
    .getByRole("radio", { name: "มีข้อมูลครบถ้วนทั้ง วัน/เดือน/ปี", exact: true })
    .check();

  // 2. เปิดปฏิทิน
  await page.getByLabel(formLabels.birthDateFull).click();

  // 3. เลือกปี (option label เป็น พ.ศ.) แล้วเลือกเดือน
  const selects = page.locator(".react-datepicker select");
  await selects.nth(1).selectOption({ label: beYear });
  await selects.nth(0).selectOption(month);

  // 4. คลิกวันที่ (ต้องไม่ใช่วันของเดือนอื่นที่ล้นมาในตาราง)
  const dayCell = page.locator(
    `.react-datepicker__day--0${day}:not(.react-datepicker__day--outside-month)`
  );
  await dayCell.first().click();
}

/**
 * กรอกฟอร์มบุคคลธรรมดาให้ครบถ้วนและถูกต้อง
 * @param {object} page
 * @param {object} overrides - ค่าที่ต้องการเขียนทับ (เช่น { telNo: "081" })
 * @param {object} options - { skipBirthDate: boolean }
 */
async function fillIndividualForm(page, overrides = {}, options = {}) {
  const data = { ...validIndividual, ...overrides };

  await page.getByLabel(formLabels.citizenId).fill(data.citizenId);
  await page.getByLabel(formLabels.laserCardId).fill(data.laserCardId);
  await page.getByLabel(formLabels.name).fill(data.name);
  await page.getByLabel(formLabels.surname).fill(data.surname);
  await page.getByLabel(formLabels.telNo).fill(data.telNo);
  if (data.email !== undefined && data.email !== null) {
    await page.getByLabel(formLabels.email).fill(data.email);
  }
  await page.getByLabel(formLabels.digitNo).fill(data.digitNo);

  if (!options.skipBirthDate) {
    await pickFullBirthDate(page, data.birthDate);
  }
}

/**
 * ปุ่มยืนยันการลงทะเบียน
 */
function submitButton(page) {
  return page.getByRole("button", { name: "ยืนยันการลงทะเบียน" });
}

module.exports = {
  fillIndividualForm,
  pickFullBirthDate,
  submitButton,
};
