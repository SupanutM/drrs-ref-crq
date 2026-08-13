/**
 * appConfig.js
 * อ่านค่า config จาก window.APP_CONFIG (public/config.js)
 * พร้อม fallback ในกรณีที่ config.js โหลดไม่ได้
 */
export const getAppConfig = () => ({
  sessionTimeout: window.APP_CONFIG?.SESSION_TIMEOUT ?? 120,  // วินาที
  sessionWarning: window.APP_CONFIG?.SESSION_WARNING ?? 15,   // วินาที
  maxConnections: window.APP_CONFIG?.MAX_CONNECTIONS ?? 5,    // จำนวน tab
});
