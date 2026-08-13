import { useState, useEffect, useRef, useCallback } from "react";
import { getAppConfig } from "utils/appConfig";

/**
 * useSessionTimeout
 * Hook จัดการ idle session timeout
 *
 * @param {boolean} enabled - เปิด/ปิด timeout (false บนหน้า Consent)
 * @returns {{ showWarning: boolean, countdown: number, forceReset: Function, setOnTimeout: Function }}
 */
function useSessionTimeout(enabled = true) {
  const config = getAppConfig();
  const TIMEOUT = config.sessionTimeout;   // วินาที รวมทั้งหมด
  const WARNING = config.sessionWarning;   // วินาที ก่อน timeout ที่จะแสดง warning

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING);

  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const countdownRef = useRef(null);
  const onTimeoutCallbackRef = useRef(null);
  // ref เพื่อ track สถานะ warning ใน event handlers (state ไม่ทันใน closure)
  const isWarningActiveRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const triggerTimeout = useCallback(() => {
    clearAllTimers();
    if (onTimeoutCallbackRef.current) {
      onTimeoutCallbackRef.current();
    }
  }, [clearAllTimers]);

  const startTimers = useCallback(() => {
    if (!enabled) return;
    clearAllTimers();
    setShowWarning(false);
    isWarningActiveRef.current = false;
    setCountdown(WARNING);

    // Timer 1: แสดง warning dialog
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      isWarningActiveRef.current = true;
      setCountdown(WARNING);

      // นับถอยหลัง — เมื่อถึง 0 ให้ navigate ทันที
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            triggerTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, (TIMEOUT - WARNING) * 1000);

    // Timer 2: hard timeout (backup safety net)
    timeoutRef.current = setTimeout(() => {
      triggerTimeout();
    }, TIMEOUT * 1000);
  }, [enabled, TIMEOUT, WARNING, clearAllTimers, triggerTimeout]);

  /**
   * forceReset — reset timer ทันทีโดยไม่สนสถานะ warning
   * ใช้สำหรับปุ่ม "ยังอยู่ในระบบ"
   */
  const forceReset = useCallback(() => {
    if (!enabled) return;
    startTimers();
  }, [enabled, startTimers]);

  /**
   * activityReset — reset timer เมื่อ user มี activity
   * ⚠️ ไม่ reset ถ้า warning dialog กำลังแสดงอยู่
   * ใช้สำหรับ event listeners (mousemove, keydown ฯลฯ)
   */
  const activityReset = useCallback(() => {
    if (!enabled) return;
    if (isWarningActiveRef.current) return;
    startTimers();
  }, [enabled, startTimers]);

  // ตั้งค่า activity listeners
  useEffect(() => {
    if (!enabled) return;

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, activityReset, { passive: true }));
    startTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, activityReset));
      clearAllTimers();
    };
  }, [enabled, activityReset, startTimers, clearAllTimers]);

  /**
   * ลงทะเบียน callback ที่จะถูกเรียกเมื่อ timeout
   * @param {Function} callback
   */
  const setOnTimeout = useCallback((callback) => {
    onTimeoutCallbackRef.current = callback;
  }, []);

  return { showWarning, countdown, forceReset, setOnTimeout };
}

export default useSessionTimeout;
