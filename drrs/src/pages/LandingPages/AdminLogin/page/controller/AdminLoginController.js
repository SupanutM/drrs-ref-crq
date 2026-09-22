import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import * as AdminLoginService from "../services/AdminLoginService";
import AdminLoginView from "../view/AdminLoginView";
import { setAdminToken, setAdminProfile } from "utils/adminAuthToken";
import LoadingComponent from "components/Loading/LoadingComponent";

function AdminLoginController() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);

  // ช่องรหัสผ่านเป็น uncontrolled input โดยเจตนา — ค่าอยู่ใน DOM ของ input เท่านั้น
  // ไม่เก็บลง React state และไม่ส่งผ่าน props เพื่อไม่ให้ค่าค้างอยู่ใน component tree
  const secretRef = useRef(null);

  const handleChangeUsername = (e) => setUsername(e.target.value);

  const handleSubmit = async () => {
    const tUsername = username.trim();
    const tSecret = (secretRef.current?.value || "").trim();

    if (!tUsername || !tSecret) {
      setIsAlert(true);
      setAlertType("warning");
      setAlertMsg("กรุณากรอก Username และ Password");
      return;
    }

    try {
      setIsLoading(true);
      setIsAlert(false);
      const res = await AdminLoginService.login(tUsername, tSecret);

      if (res.success) {
        setAdminToken(res.data.token);
        setAdminProfile({
          username: res.data.username,
          displayName: res.data.displayName,
          role: res.data.role,
        });
        // login สำเร็จแล้วพาไปหน้า reprint สัญญาเสมอ ไม่ว่า role จะเป็นอะไรก็ตาม (ตรงกับ AdminEntry
        // ใน App.js ที่พาไปหน้าเดียวกันตอนมี token ค้างอยู่แล้ว) — ADMIN/SUPERADMIN ที่ต้องเข้าหน้า
        // นำเข้าข้อมูลให้ไปกดเมนู "นำเข้าข้อมูล" บน AdminNavbar เอง ไม่ auto-redirect ให้แล้ว
        navigate("/drrs/admin/contract-reprint", { replace: true });
      } else {
        setIsAlert(true);
        setAlertType("error");
        setAlertMsg(res.message || "เข้าสู่ระบบไม่สำเร็จ");
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
      handleSubmit();
    }
  };

  const state = { username, isAlert, alertMsg, alertType, isLoading };
  const handlers = { handleChangeUsername, handleSubmit, handleKeyDown };

  return (
    <>
      <AdminLoginView state={state} handlers={handlers} secretRef={secretRef} />
      <LoadingComponent isOpen={isLoading} message="กำลังเข้าสู่ระบบ..." />
    </>
  );
}

export default AdminLoginController;
