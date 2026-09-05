import { searchContracts, downloadContract } from "api/admin";

/**
 * ค้นหาสัญญาสำหรับ reprint
 */
export const search = async ({ citizenId, accountNo, firstName, lastName }) => {
  return searchContracts({ citizenId, accountNo, firstName, lastName });
};

/**
 * ดึงไฟล์สัญญา (base64) ตาม contractFileId
 */
export const download = async (contractFileId) => {
  return downloadContract(contractFileId);
};
