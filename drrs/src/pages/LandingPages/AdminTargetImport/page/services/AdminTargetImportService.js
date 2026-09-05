import { importTargetData } from "api/admin";

/**
 * นำเข้าไฟล์ข้อมูลชี้เป้า (ลูกค้า/บัญชี/แผน) — files: { customer?, account?, plan? }
 */
export const importFiles = async (files) => {
  return importTargetData(files);
};
