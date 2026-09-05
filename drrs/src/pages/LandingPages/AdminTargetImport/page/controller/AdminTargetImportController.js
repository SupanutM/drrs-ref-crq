import React, { useState } from "react";

import * as AdminTargetImportService from "../services/AdminTargetImportService";
import AdminTargetImportView from "../view/AdminTargetImportView";
import LoadingComponent from "components/Loading/LoadingComponent";

function AdminTargetImportController() {
  const [files, setFiles] = useState({ customer: null, account: null, plan: null });
  const [results, setResults] = useState({});
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);

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

      if (res.success) {
        setIsAlert(true);
        setAlertType("success");
        setAlertMsg("นำเข้าข้อมูลสำเร็จทุกไฟล์");
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg("นำเข้าข้อมูลสำเร็จบางส่วน กรุณาดูรายละเอียดผลลัพธ์แต่ละไฟล์ด้านล่าง");
      }
    } catch (error) {
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsLoading(false);
    }
  };

  const state = { files, results, isAlert, alertMsg, alertType, isLoading };
  const handlers = { handleFileChange, handleSubmit };

  return (
    <>
      <AdminTargetImportView state={state} handlers={handlers} />
      <LoadingComponent isOpen={isLoading} message="กำลังนำเข้าข้อมูล กรุณารอสักครู่..." />
    </>
  );
}

export default AdminTargetImportController;
