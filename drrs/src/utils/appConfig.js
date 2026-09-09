/**
 * appConfig.js
 * อ่านค่า config จาก window.APP_CONFIG (public/config.js)
 * พร้อม fallback ในกรณีที่ config.js โหลดไม่ได้
 */
export const getAppConfig = () => ({
  backendUrl: window.APP_CONFIG?.BACKEND_URL || process.env.REACT_APP_BACKEND_URL,
  sessionTimeout: window.APP_CONFIG?.SESSION_TIMEOUT ?? 120,  // วินาที
  sessionWarning: window.APP_CONFIG?.SESSION_WARNING ?? 15,   // วินาที
  maxConnections: window.APP_CONFIG?.MAX_CONNECTIONS ?? 5,    // จำนวน tab
});
