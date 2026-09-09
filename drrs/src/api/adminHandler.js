import axios from "axios";
import { logger } from "utils/logger";
import { getAdminToken, clearAdminToken } from "utils/adminAuthToken";
import { getAppConfig } from "utils/appConfig";

// อ่านจาก public/config.js (window.APP_CONFIG.BACKEND_URL) ก่อน เพราะแก้บน server ได้
// โดยไม่ต้อง build ใหม่ — fallback เป็น REACT_APP_BACKEND_URL (ฝังตอน build) เผื่อ config.js โหลดไม่ได้
const baseURL = getAppConfig().backendUrl;

// axios instance แยกจาก apiAxiosInstance ของ customer (api/handler.js) โดยเจตนา —
// แนบ admin token คนละตัวกับ customer session token กันสับสน/ใช้ข้ามฝั่งกัน
const adminAxiosInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

adminAxiosInstance.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminAxiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.message || error.message;
    const statusCode = error.response?.status;

    logger.error(`[Admin API Call Failed] ${error.config?.url}`, {
      status: statusCode,
      message: errorMessage,
    });

    // token หมดอายุ/ไม่ถูกต้อง — ล้าง token ทิ้ง ให้หน้า AdminGuard เด้งไป login ใหม่
    if (statusCode === 401) {
      clearAdminToken();
    }

    return Promise.reject(error);
  }
);

export const adminGet = async (url, params) => {
  const response = await adminAxiosInstance.get(url, { params });
  return response.data;
};

export const adminPost = async (url, data, config) => {
  const response = await adminAxiosInstance.post(url, data, config);
  return response.data;
};

export const adminPut = async (url, data, config) => {
  const response = await adminAxiosInstance.put(url, data, config);
  return response.data;
};

export default adminAxiosInstance;
