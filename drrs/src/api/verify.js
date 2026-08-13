import { apiAxiosInstance } from "./handler";

export const verifyLaserId = async (payload) => {
  try {
    const response = await apiAxiosInstance.post("/api/verify-register", payload);
    return response.data;

  } catch (error) {
    console.error("Verify Laser ID Error:", error);
    throw error;
  }
};


export const checkPlan = async (payload) => {
  try {

    const response = await apiAxiosInstance.post("/api/check-plan", payload);
    return response.data;
  } catch (error) {
    console.error("Check Plan API Error:", error);
    return {
      status: false,
      message: error.response?.data?.message || "ระบบขัดข้อง"
    };
  }
};

export const updateIncome = async (payload) => {
  try {
    const response = await apiAxiosInstance.post("/api/update-income", payload);
    return response.data;
  } catch (error) {
    console.error("Update Income API Error:", error);
    throw error;
  }
};