import { adminLogin } from "api/admin";

/**
 * เรียก login admin ผ่าน AD — layer นี้เป็นตัวเดียวที่เรียก api/* ตรง (ตาม convention ของโปรเจกต์)
 */
export const login = async (username, password) => {
  return adminLogin(username, password);
};
