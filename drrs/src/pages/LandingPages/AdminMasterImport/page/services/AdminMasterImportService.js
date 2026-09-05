import { importMasterData } from "api/admin";

/**
 * นำเข้าไฟล์ master data (จังหวัด/อำเภอ/ตำบล) — files: { province?, district?, subDistrict? }
 */
export const importFiles = async (files) => {
  return importMasterData(files);
};
