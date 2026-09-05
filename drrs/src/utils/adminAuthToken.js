// จัดการ admin session token (JWT) ที่ได้จากขั้นตอน login AD
// แยก key จาก customer token (utils/authToken.js) โดยเจตนา — กันสับสน/ใช้ข้ามฝั่งกัน
// เก็บใน sessionStorage: อยู่รอด refresh หน้า แต่หายเมื่อปิด tab
const ADMIN_TOKEN_KEY = "drrs_admin_token";
const ADMIN_PROFILE_KEY = "drrs_admin_profile";

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
