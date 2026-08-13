import { useState, useEffect, useRef, useCallback } from "react";
import { getAppConfig } from "utils/appConfig";

const CHANNEL_NAME = "drrs_tab_sync";
const HEARTBEAT_INTERVAL = 5000; // ส่งทุก 5 วินาที ลด CPU/Storage load
const PONG_WAIT = 500; // รอ pong จาก Tab อื่น 500ms แล้วค่อยสรุปจำนวน

/**
 * useTabLimit
 * Hook ตรวจสอบจำนวน browser tab ที่เปิดพร้อมกัน
 * ใช้ BroadcastChannel (ไม่กระทบ localStorage, เบาและเร็ว)
 *
 * @param {boolean} enabled - เปิด/ปิดการตรวจสอบ
 * @returns {{ isOverLimit: boolean, tabCount: number }}
 */
function useTabLimit(enabled = true) {
  const config = getAppConfig();
  const MAX = config.maxConnections;

  const [isOverLimit, setIsOverLimit] = useState(false);
  const [tabCount, setTabCount] = useState(1);

  const tabIdRef = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const activeTabsRef = useRef(new Map()); // tabId -> lastSeenTimestamp
  const channelRef = useRef(null);

  const updateCount = useCallback(() => {
    const count = activeTabsRef.current.size;
    setTabCount(prev => prev !== count ? count : prev);
    setIsOverLimit(prev => {
      const next = count > MAX;
      return prev !== next ? next : prev;
    });
  }, [MAX]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof BroadcastChannel === "undefined") return;

    const myId = tabIdRef.current;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    // นับตัวเองก่อนเสมอ
    activeTabsRef.current.set(myId, Date.now());

    channel.onmessage = ({ data }) => {
      const { type, tabId } = data;
      const now = Date.now();

      if (type === "join") {
        // Tab ใหม่เข้ามา — ตอบกลับให้รู้ว่าเราอยู่
        activeTabsRef.current.set(tabId, now);
        channel.postMessage({ type: "pong", tabId: myId });
        updateCount();
      } else if (type === "pong") {
        // Tab เก่าตอบกลับ — บันทึกว่ามีอยู่
        activeTabsRef.current.set(tabId, now);
        updateCount();
      } else if (type === "heartbeat") {
        // ยืนยันว่า Tab นั้นยังอยู่
        activeTabsRef.current.set(tabId, now);
      } else if (type === "leave") {
        // Tab ปิดแล้ว
        activeTabsRef.current.delete(tabId);
        updateCount();
      }
    };

    // แจ้ง Tab อื่นว่าเราเข้ามาใหม่ แล้วรอ pong 500ms ก่อนสรุปจำนวน
    channel.postMessage({ type: "join", tabId: myId });
    const initTimer = setTimeout(() => updateCount(), PONG_WAIT);

    // Heartbeat ทุก 5 วินาที (เบามาก ไม่ lag)
    const heartbeat = setInterval(() => {
      channel.postMessage({ type: "heartbeat", tabId: myId });
    }, HEARTBEAT_INTERVAL);

    // แจ้งเมื่อปิด Tab
    const handleUnload = () => {
      channel.postMessage({ type: "leave", tabId: myId });
      channel.close();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearTimeout(initTimer);
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
      channel.postMessage({ type: "leave", tabId: myId });
      channel.close();
    };
  }, [enabled, MAX, updateCount]);

  return { isOverLimit, tabCount };
}

export default useTabLimit;
