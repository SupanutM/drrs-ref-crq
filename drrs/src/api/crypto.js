import { apiAxiosInstance, post } from "./handler";

export const decryptGCM = async (payload) => {
  try {
    const result = await post(
      "utils/decryption",
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
