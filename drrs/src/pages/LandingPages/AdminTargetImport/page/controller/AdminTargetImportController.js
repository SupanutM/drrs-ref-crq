import React, { useState, useEffect } from "react";

import * as AdminTargetImportService from "../services/AdminTargetImportService";
import AdminTargetImportView from "../view/AdminTargetImportView";
import LoadingComponent from "components/Loading/LoadingComponent";

// เวลาที่แถบแจ้งเตือน "สำเร็จ" ค้างบนจอก่อนปิดเอง (ms) — กันข้อความค้างจนต้อง refresh หน้า
const ALERT_AUTO_DISMISS_MS = 5000;

function AdminTargetImportController() {
  const [files, setFiles] = useState({ customer: null, account: null, plan: null });
  const [results, setResults] = useState({});
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);
  // เพิ่มค่านี้ทุกครั้งที่ import เสร็จ เพื่อบังคับ remount <input type=file> (uncontrolled) ให้เคลียร์
  // ค่าใน DOM ด้วย — ไม่งั้นเลือกไฟล์ "ชื่อเดิม" ซ้ำจะไม่ trigger onChange
  const [resetKey, setResetKey] = useState(0);

  // ปิดแถบแจ้งเตือน "สำเร็จ" + เคลียร์ chip ผลลัพธ์รายไฟล์เองหลังผ่านไป ALERT_AUTO_DISMISS_MS
  // (จอกลับเป็นว่างพร้อมกันหมด) — ไม่งั้นข้อความค้างจนต้อง refresh หน้า
  // เตือนแบบ error/warning ปล่อยค้างไว้ให้ user อ่าน (ปิดเองด้วยปุ่ม × เท่านั้น)
  useEffect(() => {
    if (!isAlert || alertType !== "success") return undefined;
    const timer = setTimeout(() => {
      setIsAlert(false);
      setResults({});
    }, ALERT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isAlert, alertType]);

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async () => {
    if (!files.customer && !files.account && !files.plan) {
      setIsAlert(true);
      setAlertType("warning");
      setAlertMsg("กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์");
      return;
    }

    try {
      setIsLoading(true);
      setIsAlert(false);
      const res = await AdminTargetImportService.importFiles(files);
      setResults(res.data || {});

      // เคลียร์ไฟล์ที่เลือกหลัง import จบ (ทั้งสำเร็จ/สำเร็จบางส่วน) — ชื่อไฟล์หาย ปุ่มกลับเป็น
      // "เลือกไฟล์" และ remount input เพื่อล้างค่าใน DOM กัน user งงว่าจบรึยัง/กดซ้ำโดยไม่ตั้งใจ
      // ผลลัพธ์ (results) ยังคงแสดงอยู่ให้ตรวจว่านำเข้าอะไรไปเท่าไหร่
      setFiles({ customer: null, account: null, plan: null });
      setResetKey((k) => k + 1);

      // รวมจำนวนแถวซ้ำจากทุกไฟล์ — ไฟล์ที่มีแถวซ้ำ ระบบนำเข้าให้แล้วโดยใช้ข้อมูล "แถวล่าสุด"
      // ถือว่าสำเร็จ แต่ต้องเตือนให้เจ้าหน้าที่ไปตรวจไฟล์ต้นทาง (แถบเตือนไม่ปิดเอง ต่างจากแถบสำเร็จ)
      const totalDuplicates = Object.values(res.data || {}).reduce(
        (sum, fileResult) => sum + (fileResult?.data?.duplicateCount || 0),
        0
      );

      setIsAlert(true);
      if (!res.success) {
        setAlertType("warning");
        setAlertMsg("นำเข้าข้อมูลสำเร็จบางส่วน กรุณาดูรายละเอียดผลลัพธ์แต่ละไฟล์ด้านล่าง");
      } else if (totalDuplicates > 0) {
        setAlertType("warning");
        setAlertMsg(
          `นำเข้าข้อมูลสำเร็จทุกไฟล์ แต่พบแถวซ้ำในไฟล์รวม ${totalDuplicates} แถว ` +
            "ระบบใช้ข้อมูลจากแถวล่าสุดของแต่ละรายการ กรุณาตรวจไฟล์ต้นทาง (ดูรายละเอียดด้านล่าง)"
        );
      } else {
        setAlertType("success");
        setAlertMsg("นำเข้าข้อมูลสำเร็จทุกไฟล์");
      }
    } catch (error) {
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsLoading(false);
    }
  };

  const state = { files, results, isAlert, alertMsg, alertType, isLoading, resetKey };
  const handlers = { handleFileChange, handleSubmit };

  return (
    <>
      <AdminTargetImportView state={state} handlers={handlers} />
      <LoadingComponent isOpen={isLoading} message="กำลังนำเข้าข้อมูล กรุณารอสักครู่..." />
    </>
  );
}

export default AdminTargetImportController;
