import React, { useEffect, useState } from "react";

import * as AdminUserManageService from "../services/AdminUserManageService";
import AdminUserManageView from "../view/AdminUserManageView";
import LoadingComponent from "components/Loading/LoadingComponent";
import { getAdminProfile } from "utils/adminAuthToken";
import { logger } from "utils/logger";

// ค่าเริ่มต้น role ต้องเป็น "ADMIN" (ไม่ใช่ "") เพราะตัวเลือก "ผู้ใช้ทั่วไป" ถูกเอาออกจาก dropdown
// แล้ว (ผู้ใช้ทั่วไปไม่มีแถวเก็บไว้ใน tbl_admin_user) ถ้าเหลือ "" ไว้ ตัว MKInput select จะไม่มี
// MenuItem ให้ตรงกับค่านี้ กล่องจะโชว์ว่างเปล่าและกดเพิ่มไปแล้วจะได้ role=null ผิดเจตนา
const EMPTY_FORM = { username: "", displayName: "", email: "", role: "ADMIN" };

// ค่า sentinel "ALL" หมายถึง "ไม่กรอง" (ไม่ส่ง query param นี้ไปเลย) — แยกจาก "" ที่หมายถึง
// "ผู้ใช้ทั่วไป" (role เป็น NULL ใน DB) ตามความหมายที่ backend ตีความไว้
const ROLE_FILTER_ALL = "ALL";
const STATUS_FILTER_ALL = "ALL";
const EMPTY_SEARCH = { keyword: "", role: ROLE_FILTER_ALL, status: STATUS_FILTER_ALL };

function AdminUserManageController() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAlert, setIsAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("error");
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  // ฟอร์มเพิ่มผู้ใช้ใหม่ซ่อนไว้ก่อนตั้งแต่แรก — กดปุ่มแล้วค่อยกาง กันหน้าดูรกตอนแค่เข้ามาดู/ค้นหา
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  // แสดงตารางทีละหน้า (client-side — โหลดข้อมูลทั้งหมดมาแล้วแบ่งหน้าที่ฝั่ง frontend เพราะจำนวน
  // admin ทั้งระบบมีไม่มาก ไม่คุ้มที่จะทำ server-side pagination เพิ่ม)
  const [page, setPage] = useState(1);

  // username ของ admin ที่ login อยู่ตอนนี้ — ใช้ซ่อนปุ่มถอดสิทธิ์/ระงับตัวเอง (กันล็อกตัวเองออก)
  const currentUsername = getAdminProfile()?.username;

  const loadUsers = async (searchParams = search) => {
    try {
      setIsLoading(true);
      setIsAlert(false);

      const params = {};
      const trimmedKeyword = searchParams.keyword.trim();
      if (trimmedKeyword) params.keyword = trimmedKeyword;
      if (searchParams.role !== ROLE_FILTER_ALL) params.role = searchParams.role;
      if (searchParams.status !== STATUS_FILTER_ALL) params.status = searchParams.status;

      const res = await AdminUserManageService.list(params);
      if (res.success) {
        setUsers(res.data || []);
        setPage(1); // โหลด/ค้นหาข้อมูลใหม่ทุกครั้ง กลับไปหน้า 1 เสมอ กันเคสหน้าเก่าเกินจำนวนหน้าใหม่
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg(res.message || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      }
    } catch (error) {
      logger.error("Load admin users failed", error);
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(EMPTY_SEARCH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleOpenAddForm = () => {
    setIsAddFormOpen(true);
  };

  // ปิดฟอร์มแล้วล้างค่าที่กรอกไว้ทิ้งด้วย กันเผลอเห็นข้อมูลเก่าค้างตอนเปิดใหม่รอบหน้า
  const handleCloseAddForm = () => {
    setIsAddFormOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSearchChange = (field) => (e) => {
    setSearch((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSearchSubmit = () => {
    loadUsers(search);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearchSubmit();
    }
  };

  const handleSearchClear = () => {
    setSearch(EMPTY_SEARCH);
    loadUsers(EMPTY_SEARCH);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleAddUser = async () => {
    const username = form.username.trim();
    if (!username) {
      setIsAlert(true);
      setAlertType("warning");
      setAlertMsg("กรุณาระบุ username");
      return;
    }

    try {
      setIsSubmitting(true);
      setIsAlert(false);
      const res = await AdminUserManageService.add({
        username,
        displayName: form.displayName.trim() || null,
        email: form.email.trim() || null,
        // บังคับต้องเป็น ADMIN หรือ SUPERADMIN เท่านั้น — ผู้ใช้ทั่วไปไม่เก็บลง table (ไม่มี fallback
        // เป็น null แบบเดิมแล้ว เพราะ dropdown ก็ไม่มีตัวเลือกว่างให้เลือกอยู่แล้ว)
        role: form.role,
      });

      if (res.success) {
        setIsAlert(true);
        setAlertType("success");
        setAlertMsg("เพิ่มผู้ใช้สำเร็จ");
        setForm(EMPTY_FORM);
        setIsAddFormOpen(false);
        await loadUsers(search);
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg(res.message || "เพิ่มผู้ใช้ไม่สำเร็จ");
      }
    } catch (error) {
      logger.error("Add admin user failed", error);
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setIsSubmitting(false);
    }
  };

  // เปลี่ยน role ตามที่เลือกจาก dropdown ในตาราง — เหลือ 2 ระดับให้เลือก: ADMIN / SUPERADMIN
  // (เอาตัวเลือก "ผู้ใช้ทั่วไป" ออกแล้ว เพราะไม่เก็บผู้ใช้ทั่วไปลง table — ถ้าจะเพิกถอนสิทธิ์
  // ทั้งหมด ให้ใช้ปุ่ม "ระงับบัญชี" แทนการลด role)
  const handleChangeRole = async (user, nextRole) => {
    try {
      setUpdatingId(user.id);
      setIsAlert(false);
      const res = await AdminUserManageService.updateRole(user.id, nextRole);
      if (res.success) {
        await loadUsers(search);
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg(res.message || "แก้ไขสิทธิ์ไม่สำเร็จ");
      }
    } catch (error) {
      logger.error("Update admin role failed", error);
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === "1" ? "0" : "1";
    try {
      setUpdatingId(user.id);
      setIsAlert(false);
      const res = await AdminUserManageService.updateStatus(user.id, nextStatus);
      if (res.success) {
        await loadUsers(search);
      } else {
        setIsAlert(true);
        setAlertType("warning");
        setAlertMsg(res.message || "แก้ไขสถานะไม่สำเร็จ");
      }
    } catch (error) {
      logger.error("Update admin status failed", error);
      setIsAlert(true);
      setAlertType("error");
      setAlertMsg(error.response?.data?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่ในภายหลัง");
    } finally {
      setUpdatingId(null);
    }
  };

  const state = {
    users,
    isLoading,
    isAlert,
    alertMsg,
    alertType,
    form,
    isSubmitting,
    updatingId,
    currentUsername,
    search,
    isAddFormOpen,
    page,
  };
  const handlers = {
    handleFormChange,
    handleAddUser,
    handleChangeRole,
    handleToggleStatus,
    handleSearchChange,
    handleSearchSubmit,
    handleSearchKeyDown,
    handleSearchClear,
    handleOpenAddForm,
    handleCloseAddForm,
    handlePageChange,
  };

  return (
    <>
      <AdminUserManageView state={state} handlers={handlers} />
      <LoadingComponent isOpen={isLoading} message="กำลังโหลดข้อมูล กรุณารอสักครู่..." />
    </>
  );
}

export default AdminUserManageController;
