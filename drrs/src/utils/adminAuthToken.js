// จัดการ admin session token (JWT) ที่ได้จากขั้นตอน login AD
// แยก key จาก customer token (utils/authToken.js) โดยเจตนา — กันสับสน/ใช้ข้ามฝั่งกัน
// เก็บใน sessionStorage: อยู่รอด refresh หน้า แต่หายเมื่อปิด tab
const ADMIN_TOKEN_KEY = "drrs_admin_token";
const ADMIN_PROFILE_KEY = "drrs_admin_profile";
// เหตุผลที่ถูกเด้งออกจากระบบ (เช่น "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่") — เก็บไว้ข้ามการ redirect
// ไปหน้า login เพื่อบอกผู้ใช้ว่าทำไมหลุด ไม่ใช่เด้งกลับเงียบๆ
// clearAdminToken() ตั้งใจ "ไม่ลบ" key นี้ ไม่งั้นข้อความจะหายไปพร้อม token ที่เพิ่งถูกล้าง
const ADMIN_LOGOUT_REASON_KEY = "drrs_admin_logout_reason";

export const setAdminToken = (token) => {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
};

export const getAdminToken = () => {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
};

export const clearAdminToken = () => {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_PROFILE_KEY);
};

export const setAdminProfile = (profile) => {
  if (profile) {
    sessionStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
  }
};

export const getAdminProfile = () => {
  const raw = sessionStorage.getItem(ADMIN_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
};

/**
 * บันทึกเหตุผลที่ถูกเด้งออกจากระบบ ให้หน้า login หยิบไปแสดง
 * เรียกจาก adminHandler.js ตอนเจอ 401 (ต้องเรียก "หลัง" clearAdminToken เสมอ)
 */
export const setAdminLogoutReason = (reason) => {
  if (reason) {
    sessionStorage.setItem(ADMIN_LOGOUT_REASON_KEY, reason);
  }
};

/**
 * อ่านเหตุผลที่ถูกเด้งออก แล้วลบทิ้งทันที (one-shot) — แสดงครั้งเดียวจบ
 * ถ้าไม่ลบ ข้อความจะค้างโชว์ทุกครั้งที่กลับมาหน้า login แม้ผู้ใช้กด logout เองก็ตาม
 */
export const consumeAdminLogoutReason = () => {
  const reason = sessionStorage.getItem(ADMIN_LOGOUT_REASON_KEY);
  sessionStorage.removeItem(ADMIN_LOGOUT_REASON_KEY);
  return reason;
};
