import { apiAxiosInstance, post } from "./handler";

export const encryptGCM = async (payload) => {
  try {
    const result = await post(
      "utils/encryption",
      payload,
      undefined,
      apiAxiosInstance,
      undefined
    );
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

/**
 * เข้ารหัสหลาย field ในคำขอเดียว (1 request) แทนการยิงแยกทีละ field
 * @param {Object} values - object ของ field ที่ต้องเข้ารหัส เช่น { citizenId: "...", name: "..." }
 * @returns {Promise<Object>} - { citizenId: "iv:enc:tag", name: "iv:enc:tag", ... } ตามคีย์ที่ส่งไป
 */
export const encryptGCMBatch = async (values) => {
  try {
    const result = await post(
      "utils/encryption",
      { values },
      undefined,
      apiAxiosInstance,
      undefined
    );
    return result?.encrypted || {};
  } catch (error) {
    console.error(error);
    throw error;
  }
};
