// จัดการ session token (JWT) ที่ได้จากขั้นตอน verify
// เก็บใน sessionStorage: อยู่รอด refresh หน้า แต่หายเมื่อปิด tab
const TOKEN_KEY = "drrs_session_token";

export const setToken = (token) => {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};

export const getToken = () => {
  return sessionStorage.getItem(TOKEN_KEY);
};

export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
};
