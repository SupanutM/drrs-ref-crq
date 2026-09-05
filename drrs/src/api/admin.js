import { adminGet, adminPost, adminPut } from "./adminHandler";

/**
 * Login admin ผ่าน Active Directory
 */
export const adminLogin = (username, password) => {
  return adminPost("/api/admin/login", { username, password });
};

/**
 * นำเข้าข้อมูล master (จังหวัด/อำเภอ/ตำบล) — ส่งได้พร้อมกันสูงสุด 3 ไฟล์ .xlsx
 * files: { province?: File, district?: File, subDistrict?: File }
 */
export const importMasterData = (files) => {
  const formData = new FormData();
  if (files.province) formData.append("province", files.province);
  if (files.district) formData.append("district", files.district);
  if (files.subDistrict) formData.append("subDistrict", files.subDistrict);

  return adminPost("/api/admin/master/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/**
 * นำเข้าข้อมูลชี้เป้า (ลูกค้า/บัญชี/แผน) — ส่งได้พร้อมกันสูงสุด 3 ไฟล์ .csv
 * (pipe-delimited, encoding Windows-874, ไม่มี header — ไม่รองรับ .xlsx อีกต่อไป)
 * files: { customer?: File, account?: File, plan?: File }
 */
export const importTargetData = (files) => {
  const formData = new FormData();
  if (files.customer) formData.append("customer", files.customer);
  if (files.account) formData.append("account", files.account);
  if (files.plan) formData.append("plan", files.plan);

  return adminPost("/api/admin/target/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/**
 * ค้นหาสัญญาสำหรับ reprint — ค้นด้วยเลขบัตรประชาชน, ชื่อ, นามสกุล, และ/หรือเลขบัญชี
 */
export const searchContracts = ({ citizenId, accountNo, firstName, lastName }) => {
  return adminGet("/api/admin/contract/search", { citizenId, accountNo, firstName, lastName });
};

/**
 * ดึงไฟล์สัญญา (base64) ตาม contractFileId เพื่อ reprint/ดาวน์โหลด
 */
export const downloadContract = (contractFileId) => {
  return adminGet(`/api/admin/contract/${contractFileId}/download`);
};

/**
 * ดึงรายชื่อผู้ใช้ admin ทั้งหมด (จัดการสิทธิ์) — ค้นหา/กรองแบบไม่บังคับ
 * params: { keyword?, role?, status? }
 *   - keyword: ค้นแบบ contains กับ username/ชื่อที่แสดง/อีเมล
 *   - role: "ADMIN" | "SUPERADMIN" | "" (ผู้ใช้ทั่วไป) — ไม่ส่งคีย์นี้ = ไม่กรอง role
 *   - status: "1" | "0" — ไม่ส่งคีย์นี้ = ไม่กรอง status
 */
export const listAdminUsers = (params) => {
  return adminGet("/api/admin/user-management", params);
};

/**
 * เพิ่มผู้ใช้ admin ใหม่เข้า whitelist
 * payload: { username, displayName?, email?, role? } — role: "ADMIN" หรือ null/ไม่ส่ง
 */
export const addAdminUser = (payload) => {
  return adminPost("/api/admin/user-management", payload);
};

/**
 * แก้ไข role และ/หรือ status ของผู้ใช้ admin ที่มีอยู่แล้ว
 * payload: { role?, status? } — status: "1" (ใช้งานได้) หรือ "0" (ระงับ)
 */
export const updateAdminUser = (id, payload) => {
  return adminPut(`/api/admin/user-management/${id}`, payload);
};
