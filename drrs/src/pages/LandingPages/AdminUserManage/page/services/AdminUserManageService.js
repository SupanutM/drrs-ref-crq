import { listAdminUsers, addAdminUser, updateAdminUser } from "api/admin";

/**
 * ดึงรายชื่อผู้ใช้ admin ทั้งหมด — ค้นหา/กรองแบบไม่บังคับ (params: { keyword?, role?, status? })
 */
export const list = async (params) => {
  return listAdminUsers(params);
};

/**
 * เพิ่มผู้ใช้ admin ใหม่เข้า whitelist
 */
export const add = async ({ username, displayName, email, role }) => {
  return addAdminUser({ username, displayName, email, role });
};

/**
 * แก้ไข role ของผู้ใช้ (ให้/ถอดสิทธิ์ ADMIN)
 */
export const updateRole = async (id, role) => {
  return updateAdminUser(id, { role });
};

/**
 * แก้ไข status ของผู้ใช้ (ระงับ/เปิดใช้งาน)
 */
export const updateStatus = async (id, status) => {
  return updateAdminUser(id, { status });
};
