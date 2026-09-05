import React, { useState } from "react";

import * as AdminContractReprintService from "../services/AdminContractReprintService";
import AdminContractReprintView from "../view/AdminContractReprintView";
import LoadingComponent from "components/Loading/LoadingComponent";
import { logger } from "utils/logger";

/**
 * แปลง base64 -> Blob แล้วสั่งดาวน์โหลดผ่าน anchor element ชั่วคราว
 * (ไม่ใช้ window.open เพราะ browser บางตัว block popup)
 */
const downloadBase64Pdf = (base64Content, fileName) => {
  const byteCharacters = atob(base64Content);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "contract.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function AdminContractReprintController() {
  const [citizenId, setCitizenId] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [results, setResults] = useState([]);
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  // แสดงผลลัพธ์การค้นหาทีละหน้า (client-side — ผลค้นหาทั้งหมดยิง API ครั้งเดียว แล้วแบ่งหน้า
  // ที่ฝั่ง frontend เพราะจำนวนสัญญาต่อการค้นหาไม่มาก ไม่คุ้มที่จะทำ server-side pagination เพิ่ม)
  const [page, setPage] = useState(1);

  const handleChangeCitizenId = (e) => setCitizenId(e.target.value);
  const handleChangeAccountNo = (e) => setAccountNo(e.target.value);
  const handleChangeFirstName = (e) => setFirstName(e.target.value);
  const handleChangeLastName = (e) => setLastName(e.target.value);

  const handleSearch = async () => {
    const tCitizenId = citizenId.trim();
    const tAccountNo = accountNo.trim();
    const tFirstName = firstName.trim();
    const tLastName = lastName.trim();

    if (!tCitizenId && !tAccountNo && !tFirstName && !tLastName) {
      setIsAlert(true);
      setAlertType("warning");
      setAlertMsg("กรุณาระบุเลขบัตรประชาชน เลขบัญชี ชื่อ หรือนามสกุล อย่างน้อย 1 อย่าง");
      return;
    }

    try {
      setIsLoading(true);
      setIsAlert(false);
      setResults([]);
      const res = await AdminContractReprintService.search({
        citizenId: tCitizenId,
        accountNo: tAccountNo,
        firstName: tFirstName,
        lastName: tLastName,
      });

      if (res.success) {
        setResults(res.data || []);
        setPage(1); // ค้นหาใหม่ทุกครั้ง กลับไปหน้า 1 เสมอ กันเคสหน้าเก่าเกินจำนวนหน้าใหม่
        if (!res.data || res.data.length === 0) {
          setIsAlert(true);
          setAlertType("info");
          setAlertMsg(res.message || "ไม่พบสัญญาตามเงื่อนไขที่ระบุ");
        }
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg(res.message || "ค้นหาไม่สำเร็จ");
      }
    } catch (error) {
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setCitizenId("");
    setAccountNo("");
    setFirstName("");
    setLastName("");
    setResults([]);
    setIsAlert(false);
    setPage(1);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleDownload = async (contractFileId) => {
    try {
      setDownloadingId(contractFileId);
      const res = await AdminContractReprintService.download(contractFileId);
      if (res.success) {
        downloadBase64Pdf(res.data.base64Content, res.data.fileName);
      } else {
        setIsAlert(true);
        setAlertType("error");
        setAlertMsg(res.message || "ดาวน์โหลดไม่สำเร็จ");
      }
    } catch (error) {
      logger.error("Download contract failed", error);
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาดระหว่างดาวน์โหลด");
    } finally {
      setDownloadingId(null);
    }
  };

  const state = {
    citizenId,
    accountNo,
    firstName,
    lastName,
    results,
    isAlert,
    alertMsg,
    alertType,
    isLoading,
    downloadingId,
    page,
  };
  const handlers = {
    handleChangeCitizenId,
    handleChangeAccountNo,
    handleChangeFirstName,
    handleChangeLastName,
    handleSearch,
    handleClear,
    handleKeyDown,
    handleDownload,
    handlePageChange,
  };

  return (
    <>
      <AdminContractReprintView state={state} handlers={handlers} />
      <LoadingComponent isOpen={isLoading} message="กำลังค้นหา กรุณารอสักครู่..." />
    </>
  );
}

export default AdminContractReprintController;
