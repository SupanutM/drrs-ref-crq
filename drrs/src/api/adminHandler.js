import axios from "axios";
import { logger } from "utils/logger";
import { getAdminToken, clearAdminToken, setAdminLogoutReason } from "utils/adminAuthToken";
import { getAppConfig } from "utils/appConfig";

// อ่านจาก public/config.js (window.APP_CONFIG.BACKEND_URL) ก่อน เพราะแก้บน server ได้
// โดยไม่ต้อง build ใหม่ — fallback เป็น REACT_APP_BACKEND_URL (ฝังตอน build) เผื่อ config.js โหลดไม่ได้
const baseURL = getAppConfig().backendUrl;

// ข้อความ 401 แบบกลางๆ จาก backend ที่ "ห้าม" เอาไปแสดงให้ผู้ใช้เห็นตรงๆ (ต้องแทนด้วยข้อความไทย)
const GENERIC_401_MESSAGES = ["unauthorized"];

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

      // เก็บเหตุผลไว้ให้หน้า login แสดง (เช่น "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" ที่
      // adminAuthMiddleware ส่งมา) ไม่งั้นผู้ใช้จะถูกเด้งกลับหน้า login เงียบๆ ไม่รู้ว่าเกิดอะไรขึ้น
      // ต้องเรียก "หลัง" clearAdminToken เสมอ และข้าม endpoint login เอง เพราะ 401 ของหน้า login
      // (รหัสผ่านผิด) หน้านั้นแสดง error ของตัวเองอยู่แล้ว ถ้าเก็บซ้ำจะไปโชว์ค้างรอบถัดไป
      const failedUrl = error.config?.url || "";
      if (!failedUrl.includes("/admin/login")) {
        // backend ส่งข้อความไทยมาเฉพาะเคส "หมดอายุ" เคสอื่นส่งคำกลางๆ เป็นภาษาอังกฤษ
        // ("unauthorized" — ตั้งใจไม่บอกรายละเอียดออกไป) ห้ามเอาคำนั้นไปโชว์ผู้ใช้ตรงๆ
        const isGenericMessage =
          !errorMessage || GENERIC_401_MESSAGES.includes(errorMessage.trim().toLowerCase());
        setAdminLogoutReason(
          isGenericMessage ? "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" : errorMessage
        );
      }
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
