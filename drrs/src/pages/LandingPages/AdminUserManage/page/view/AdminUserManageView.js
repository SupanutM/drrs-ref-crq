import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKInput from "components/MKInput";
import MKButton from "components/MKButton";
import MKAlert from "components/MKAlert";

import { formatThaiDate } from "utils/day";

// สัดส่วนคอลัมน์ของตาราง — ประกาศไว้ที่เดียว ใช้ทั้ง header และทุกแถวข้อมูล (แบบเดียวกับหน้า
// AdminContractReprint) กันหัวตารางเลื่อนไม่ตรงกับข้อมูลตอนเนื้อหาสั้น/ยาวไม่เท่ากัน
// ลำดับ: username, ชื่อที่แสดง, สิทธิ์, สถานะ, login ล่าสุด, ดำเนินการ
const GRID_COLUMNS = "18% 20% 14% 12% 18% 18%";

// จำนวนแถวต่อหน้าของตาราง — แบ่งหน้าฝั่ง frontend (client-side) เพราะจำนวน admin ทั้งระบบมีไม่มาก
const PAGE_SIZE = 10;

// สิทธิ์ ADMIN/SUPERADMIN แสดงเป็น Chip คนละสี — role ว่าง (null) คือผู้ใช้ทั่วไป
const ROLE_CHIP = {
  SUPERADMIN: { label: "SUPERADMIN", color: "error" },
  ADMIN: { label: "ADMIN", color: "primary" },
  DEFAULT: { label: "ทั่วไป", color: "default" },
};

// theme กลาง (assets/theme/components/form/select.js) บังคับ padding ของกล่อง select ไว้ที่
// "0 12px !important" ด้วย specificity 2 class คู่กัน — sx ธรรมดา specificity เท่ากันจะแพ้ตาม
// ลำดับประกาศใน stylesheet (ซึ่งดันเป็นของ theme) ต้องเพิ่ม specificity ให้สูงกว่า (3 class ขึ้นไป)
// ถึงจะ override ได้แน่นอน ยืนยันด้วย DevTools แล้วว่าได้ความสูงเท่ากับ input ปกติเป๊ะ
// เรียกใช้แทนเขียน object ซ้ำทุกจุดที่มี select ในหน้านี้ (ฟอร์มเพิ่มผู้ใช้, ค้นหา, ตาราง)
const SELECT_HEIGHT_FIX_SX = (paddingPx) => ({
  "&.MuiFormControl-root .MuiInputBase-root .MuiSelect-select.MuiSelect-select": {
    paddingTop: `${paddingPx}px !important`,
    paddingBottom: `${paddingPx}px !important`,
    boxSizing: "border-box !important",
    height: "auto !important",
  },
});

function AdminUserManageView({ state, handlers }) {
  const {
    users,
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
  } = state;
  const {
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
  } = handlers;

  // ตัดเอาแค่แถวของหน้าปัจจุบันมาแสดง (ข้อมูลทั้งหมดยังอยู่ใน users เดิม ไม่ได้ยิง API ใหม่ตอนเปลี่ยนหน้า)
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} md={10}>
        <MKBox mb={3}>
          <MKTypography variant="h4" fontWeight="bold" color="dark">
            จัดการสิทธิ์ผู้ใช้ Admin
          </MKTypography>
          {/* <MKTypography variant="body2" color="text" mt={1}>
            กำหนดสิทธิ์ 2 ระดับ: ADMIN (นำเข้าข้อมูลได้), SUPERADMIN (ทำได้ทุกอย่างของ ADMIN +
            จัดการสิทธิ์ผู้ใช้คนอื่นในหน้านี้) — หน้านี้จัดการเฉพาะผู้ใช้ที่มีสิทธิ์ ADMIN/SUPERADMIN
            เท่านั้น (ผู้ใช้ทั่วไปไม่มีแถวเก็บไว้ในระบบ) ถ้าต้องการเพิกถอนสิทธิ์ให้ใช้ปุ่มระงับบัญชี —
            ระบบต้องมี SUPERADMIN ที่ใช้งานได้อย่างน้อย 1 คนเสมอ
          </MKTypography> */}
        </MKBox>

        {isAlert && (
          <Fade in={isAlert}>
            <MKBox mb={2}>
              <MKAlert color={alertType} dismissible>
                {alertMsg}
              </MKAlert>
            </MKBox>
          </Fade>
        )}

        {/* ปุ่มเปิดฟอร์มเพิ่มผู้ใช้ใหม่ — ซ่อนฟอร์มไว้ก่อนตั้งแต่แรก กันหน้าดูรกตอนแค่เข้ามาดู/ค้นหา
            แสดงเฉพาะตอนฟอร์มยังปิดอยู่ (สลับกับปุ่มยกเลิกด้านในฟอร์มตอนเปิด) */}
        {!isAddFormOpen && (
          <MKBox mb={3} textAlign="right">
            <MKButton variant="gradient" color="primary" onClick={handleOpenAddForm}>
              + เพิ่มผู้ใช้ admin ใหม่
            </MKButton>
          </MKBox>
        )}

        {/* ฟอร์มเพิ่มผู้ใช้ใหม่ — เผื่อกรณีต้องให้สิทธิ์ ADMIN ล่วงหน้าก่อน user คนนั้น login AD ครั้งแรก
            กางออกเมื่อกดปุ่มด้านบนเท่านั้น (Collapse ไม่ unmount ฟอร์มทิ้งตอนปิด แต่ไม่กระทบอะไร
            เพราะ handleCloseAddForm ล้างค่า form ทิ้งอยู่แล้วทุกครั้งที่ปิด) */}
        <Collapse in={isAddFormOpen}>
          <MKBox component={Paper} sx={{ p: 3, mb: 3, border: "1px solid #e0e0e0", borderRadius: "8px" }}>
            <MKBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <MKTypography variant="h6" fontWeight="bold">
                เพิ่มผู้ใช้ admin ใหม่
              </MKTypography>
              <MKButton variant="text" color="secondary" size="small" onClick={handleCloseAddForm}>
                ยกเลิก
              </MKButton>
            </MKBox>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <MKInput
                  type="text"
                  label="Username (AD)"
                  fullWidth
                  value={form.username}
                  onChange={handleFormChange("username")}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MKInput
                  type="text"
                  label="ชื่อที่แสดง (ไม่บังคับ)"
                  fullWidth
                  value={form.displayName}
                  onChange={handleFormChange("displayName")}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MKInput
                  type="email"
                  label="อีเมล (ไม่บังคับ)"
                  fullWidth
                  value={form.email}
                  onChange={handleFormChange("email")}
                  disabled={isSubmitting}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <MKInput
                  select
                  label="สิทธิ์"
                  fullWidth
                  value={form.role}
                  onChange={handleFormChange("role")}
                  disabled={isSubmitting}
                  InputLabelProps={{ shrink: true }}
                  sx={SELECT_HEIGHT_FIX_SX(12)}
                >
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                  <MenuItem value="SUPERADMIN">SUPERADMIN</MenuItem>
                </MKInput>
              </Grid>
              <Grid item xs={12} md={1} display="flex" alignItems="center">
                <MKButton
                  variant="gradient"
                  color="primary"
                  fullWidth
                  onClick={handleAddUser}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่ม"}
                </MKButton>
              </Grid>
            </Grid>
          </MKBox>
        </Collapse>

        {/* ค้นหา/กรองรายชื่อผู้ใช้ admin — keyword (username/ชื่อที่แสดง/อีเมล) + สิทธิ์ + สถานะ */}
        <MKBox component={Paper} sx={{ p: 3, mb: 3, border: "1px solid #e0e0e0", borderRadius: "8px" }}>
          <MKTypography variant="h6" fontWeight="bold" mb={2}>
            ค้นหาผู้ใช้ admin
          </MKTypography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <MKInput
                type="text"
                label="ค้นหา (username / ชื่อที่แสดง / อีเมล)"
                fullWidth
                value={search.keyword}
                onChange={handleSearchChange("keyword")}
                onKeyDown={handleSearchKeyDown}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MKInput
                select
                label="สิทธิ์"
                fullWidth
                value={search.role}
                onChange={handleSearchChange("role")}
                InputLabelProps={{ shrink: true }}
                sx={SELECT_HEIGHT_FIX_SX(12)}
              >
                <MenuItem value="ALL">ทั้งหมด</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
                <MenuItem value="SUPERADMIN">SUPERADMIN</MenuItem>
              </MKInput>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <MKInput
                select
                label="สถานะ"
                fullWidth
                value={search.status}
                onChange={handleSearchChange("status")}
                InputLabelProps={{ shrink: true }}
                sx={SELECT_HEIGHT_FIX_SX(12)}
              >
                <MenuItem value="ALL">ทั้งหมด</MenuItem>
                <MenuItem value="1">ใช้งานได้</MenuItem>
                <MenuItem value="0">ถูกระงับ</MenuItem>
              </MKInput>
            </Grid>
            <Grid item xs={12} sm={6} md={3} display="flex" gap={1}>
              <MKButton variant="gradient" color="primary" fullWidth onClick={handleSearchSubmit}>
                ค้นหา
              </MKButton>
              <MKButton variant="outlined" color="secondary" fullWidth onClick={handleSearchClear}>
                ล้าง
              </MKButton>
            </Grid>
          </Grid>
        </MKBox>

        {/* ตารายชื่อผู้ใช้ admin ทั้งหมด */}
        <MKBox component={Paper} sx={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
          <MKBox
            sx={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              backgroundColor: "#f8f9fa",
              borderBottom: "1px solid #e0e0e0",
              px: 2,
              py: 1.2,
            }}
          >
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              Username
            </MKTypography>
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              ชื่อที่แสดง
            </MKTypography>
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              สิทธิ์
            </MKTypography>
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              สถานะ
            </MKTypography>
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              Login ล่าสุด
            </MKTypography>
            <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
              ดำเนินการ
            </MKTypography>
          </MKBox>

          {users.length === 0 && (
            <MKBox px={2} py={3} textAlign="center">
              <MKTypography variant="body2" color="text">
                ยังไม่มีผู้ใช้ admin ในระบบ
              </MKTypography>
            </MKBox>
          )}

          {pagedUsers.map((user, index) => {
            const isSelf = user.username === currentUsername;
            const isActive = user.status === "1";
            const isRowUpdating = updatingId === user.id;
            const roleChip = ROLE_CHIP[user.role] || ROLE_CHIP.DEFAULT;

            return (
              <MKBox
                key={user.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: GRID_COLUMNS,
                  alignItems: "center",
                  px: 2,
                  py: 1.2,
                  borderBottom: index < pagedUsers.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {user.username}
                  {isSelf && (
                    <MKTypography component="span" variant="caption" color="info" ml={0.5}>
                      (คุณ)
                    </MKTypography>
                  )}
                </MKTypography>
                <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {user.displayName || "-"}
                </MKTypography>
                <MKBox textAlign="center">
                  <Chip size="small" label={roleChip.label} color={roleChip.color} />
                </MKBox>
                <MKBox textAlign="center">
                  <Chip
                    size="small"
                    label={isActive ? "ใช้งานได้" : "ถูกระงับ"}
                    color={isActive ? "success" : "error"}
                  />
                </MKBox>
                <MKTypography variant="body2" textAlign="center">
                  {formatThaiDate(user.lastLoginDate, "ยังไม่เคย login")}
                </MKTypography>
                <MKBox display="flex" gap={1} justifyContent="center" alignItems="center" flexWrap="wrap">
                  {/* เลือกสิทธิ์ได้แค่ ADMIN / SUPERADMIN — ไม่มีตัวเลือก "ผู้ใช้ทั่วไป" เพราะ
                      ผู้ใช้ทั่วไปไม่มีแถวเก็บไว้ใน tbl_admin_user เลย (ดู adminAuthService.js) หน้านี้
                      จัดการเฉพาะคนที่มีสิทธิ์ ADMIN/SUPERADMIN อยู่แล้ว ถ้าต้องการเพิกถอนสิทธิ์ทั้งหมด
                      ให้ใช้ปุ่ม "ระงับบัญชี" ด้านขวาแทน (ไม่ใช่ลด role ลงเป็นว่าง) — ปิดการแก้ไข
                      แถวของตัวเองเสมอ กันล็อกตัวเองออกจากระบบ (ดู logic กันใน backend service) */}
                  <MKInput
                    select
                    size="small"
                    value={user.role || ""}
                    onChange={(e) => handleChangeRole(user, e.target.value)}
                    disabled={isRowUpdating || isSelf}
                    sx={{ minWidth: 120, ...SELECT_HEIGHT_FIX_SX(10) }}
                  >
                    <MenuItem value="ADMIN">ADMIN</MenuItem>
                    <MenuItem value="SUPERADMIN">SUPERADMIN</MenuItem>
                  </MKInput>
                  <MKButton
                    variant="outlined"
                    color={isActive ? "error" : "success"}
                    size="small"
                    onClick={() => handleToggleStatus(user)}
                    disabled={isRowUpdating || isSelf}
                  >
                    {isActive ? "ระงับบัญชี" : "เปิดใช้งาน"}
                  </MKButton>
                </MKBox>
              </MKBox>
            );
          })}
        </MKBox>

        {/* แสดง pagination เฉพาะตอนมีมากกว่า 1 หน้า — กันโชว์เปล่าๆตอนข้อมูลน้อย */}
        {users.length > PAGE_SIZE && (
          <MKBox mt={2} display="flex" justifyContent="center">
            <Pagination count={pageCount} page={page} onChange={handlePageChange} color="primary" />
          </MKBox>
        )}
      </Grid>
    </Grid>
  );
}

AdminUserManageView.propTypes = {
  state: PropTypes.shape({
    users: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number,
        username: PropTypes.string,
        displayName: PropTypes.string,
        role: PropTypes.string,
        status: PropTypes.string,
        lastLoginDate: PropTypes.string,
      })
    ).isRequired,
    isAlert: PropTypes.bool.isRequired,
    alertMsg: PropTypes.string.isRequired,
    alertType: PropTypes.string.isRequired,
    form: PropTypes.shape({
      username: PropTypes.string,
      displayName: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
    }).isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    updatingId: PropTypes.number,
    currentUsername: PropTypes.string,
    search: PropTypes.shape({
      keyword: PropTypes.string,
      role: PropTypes.string,
      status: PropTypes.string,
    }).isRequired,
    isAddFormOpen: PropTypes.bool.isRequired,
    page: PropTypes.number.isRequired,
  }).isRequired,
  handlers: PropTypes.shape({
    handleFormChange: PropTypes.func.isRequired,
    handleAddUser: PropTypes.func.isRequired,
    handleChangeRole: PropTypes.func.isRequired,
    handleToggleStatus: PropTypes.func.isRequired,
    handleSearchChange: PropTypes.func.isRequired,
    handleSearchSubmit: PropTypes.func.isRequired,
    handleSearchKeyDown: PropTypes.func.isRequired,
    handleSearchClear: PropTypes.func.isRequired,
    handleOpenAddForm: PropTypes.func.isRequired,
    handleCloseAddForm: PropTypes.func.isRequired,
    handlePageChange: PropTypes.func.isRequired,
  }).isRequired,
};

export default AdminUserManageView;
