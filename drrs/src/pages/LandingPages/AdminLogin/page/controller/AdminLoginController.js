import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import * as AdminLoginService from "../services/AdminLoginService";
import AdminLoginView from "../view/AdminLoginView";
import { setAdminToken, setAdminProfile } from "utils/adminAuthToken";
import LoadingComponent from "components/Loading/LoadingComponent";

function AdminLoginController() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [isLoading, setIsLoading] = useState(false);

  const handleChangeUsername = (e) => setUsername(e.target.value);
  const handleChangePassword = (e) => setPassword(e.target.value);

  const handleSubmit = async () => {
    const tUsername = username.trim();
    const tPassword = password.trim();

    if (!tUsername || !tPassword) {
      setIsAlert(true);
      setAlertType("warning");
      setAlertMsg("กรุณากรอก Username และ Password");
      return;
    }

    try {
      setIsLoading(true);
      setIsAlert(false);
      const res = await AdminLoginService.login(tUsername, tPassword);

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

  const state = { username, password, isAlert, alertMsg, alertType, isLoading };
  const handlers = { handleChangeUsername, handleChangePassword, handleSubmit, handleKeyDown };

  return (
    <>
      <AdminLoginView state={state} handlers={handlers} />
      <LoadingComponent isOpen={isLoading} message="กำลังเข้าสู่ระบบ..." />
    </>
  );
}

export default AdminLoginController;
