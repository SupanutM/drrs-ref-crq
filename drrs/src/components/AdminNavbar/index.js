import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuIcon from "@mui/icons-material/Menu";

import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import { clearAdminToken, getAdminProfile } from "utils/adminAuthToken";

/**
 * AdminNavbar
 * แถบเมนูด้านบนของทุกหน้า admin (หลัง login) — สลับหน้าได้ครบ 3 ฟีเจอร์ + ปุ่ม logout
 */
function AdminNavbar() {
  const navigate = useNavigate();
  const profile = getAdminProfile();
  const isSuperAdmin = profile?.role === "SUPERADMIN";
  const isAdmin = isSuperAdmin || profile?.role === "ADMIN";

  // เมนู "นำเข้าข้อมูล" รวม Master Data กับข้อมูลชี้เป้าไว้ dropdown เดียว (เดิมแยกเป็น 2 ปุ่ม
  // บนแถบเมนูตรงๆ ทำให้แถบดูรก) เก็บ anchor element ไว้เปิด/ปิด MUI Menu
  const [importMenuAnchor, setImportMenuAnchor] = useState(null);
  const isImportMenuOpen = Boolean(importMenuAnchor);

  const handleOpenImportMenu = (e) => setImportMenuAnchor(e.currentTarget);
  const handleCloseImportMenu = () => setImportMenuAnchor(null);
  const handleNavigateImport = (path) => {
    handleCloseImportMenu();
    navigate(path);
  };

  // เมนู hamburger สำหรับจอมือถือ — รวมทุกเมนู (นำทาง + import) ไว้ dropdown เดียว
  // แทนการวางปุ่มเรียงกันบนแถบ (จอแคบปุ่มจะตัดบรรทัดมั่ว ดูรก)
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const isMobileMenuOpen = Boolean(mobileMenuAnchor);
  const handleOpenMobileMenu = (e) => setMobileMenuAnchor(e.currentTarget);
  const handleCloseMobileMenu = () => setMobileMenuAnchor(null);
  const handleNavigateMobile = (path) => {
    handleCloseMobileMenu();
    navigate(path);
  };

  const handleLogout = () => {
    clearAdminToken();
    navigate("/drrs/admin/login", { replace: true });
  };

  return (
    // ใช้สี primary ของธีม DRRS (#eb3a75) แทนสี dark เดิม ให้ตรงกับแถบหัวของหน้าลูกค้าปกติ (เช่นหน้า Consent)
    <AppBar position="static" color="default" elevation={1} sx={{ backgroundColor: "#eb3a75" }}>
      <Toolbar sx={{ gap: 1 }}>
        <MKTypography variant="h6" color="white" sx={{ flexGrow: 1 }}>
          DRRS Admin
        </MKTypography>

        {/*
          ใช้ MKButton (คอมโพเนนต์ของธีม Material Kit) แทน MUI Button เปล่า —
          โปรเจกต์นี้ไม่มี ThemeProvider ครอบ MUI Button เปล่าจึงใช้สีน้ำเงิน default ของ MUI
          ทับ sx={{color:"white"}} (ปุ่ม variant="text" ของ MUI มี class สีที่ specificity สูงกว่า
          inline sx) ทำให้ตัวหนังสือออกมาเป็นสีน้ำเงินบนพื้นชมพู อ่านยากและดูไม่เข้าธีม
          MKButton คำนวณสีจาก prop color ตรงๆ ไม่พึ่ง default ของ MUI จึงได้สีขาวชัดเจนแน่นอน
        */}
        {/* กลุ่มปุ่มเมนูแบบวางเรียง — โชว์เฉพาะจอ md ขึ้นไป (จอมือถือใช้ hamburger แทน) */}
        <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, alignItems: "center" }}>
          {/* จัดการสิทธิ์ผู้ใช้ admin — เห็นแค่ role=SUPERADMIN เท่านั้น (ADMIN ธรรมดาทำไม่ได้) */}
          {isSuperAdmin && (
            <MKButton
              variant="text"
              color="white"
              size="small"
              onClick={() => navigate("/drrs/admin/user-management")}
            >
              จัดการสิทธิ์ผู้ใช้
            </MKButton>
          )}
          {/* เมนูนำเข้าข้อมูล — รวม Master Data กับข้อมูลชี้เป้าไว้ dropdown กลุ่มเดียวกัน
              เห็นแค่ role=ADMIN ขึ้นไปเท่านั้น — ผู้ใช้ทั่วไปทำได้แค่ reprint สัญญา */}
          {isAdmin && (
            <>
              <MKButton
                variant="text"
                color="white"
                size="small"
                onClick={handleOpenImportMenu}
                endIcon={<KeyboardArrowDownIcon />}
              >
                นำเข้าข้อมูล
              </MKButton>
              <Menu anchorEl={importMenuAnchor} open={isImportMenuOpen} onClose={handleCloseImportMenu}>
                <MenuItem onClick={() => handleNavigateImport("/drrs/admin/master-import")}>
                  MasterData
                </MenuItem>
                <MenuItem onClick={() => handleNavigateImport("/drrs/admin/target-import")}>
                  ข้อมูลชี้เป้า
                </MenuItem>
              </Menu>
            </>
          )}
          <MKButton
            variant="text"
            color="white"
            size="small"
            onClick={() => navigate("/drrs/admin/contract-reprint")}
          >
            Reprint สัญญา
          </MKButton>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* แสดง role แทน username เดิม — username ไม่ค่อยมีประโยชน์กับคนดู ส่วน role บอกสิทธิ์
              การใช้งานตรงกว่า (ยังไม่มี role กรณีเข้ามาแบบผู้ใช้ทั่วไป — chip จะไม่โผล่ให้เห็น) */}
          {profile?.role && (
            <Chip
              size="small"
              label={profile.role}
              sx={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                fontWeight: "bold",
              }}
            />
          )}
          {/* ปุ่ม logout — โชว์เฉพาะ md ขึ้นไป (จอมือถือย้ายไปอยู่ในเมนู hamburger) */}
          <MKButton
            variant="outlined"
            color="white"
            size="small"
            onClick={handleLogout}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            ออกจากระบบ
          </MKButton>

          {/* ปุ่ม hamburger — โชว์เฉพาะจอมือถือ (ต่ำกว่า md) รวมทุกเมนูไว้ dropdown เดียว */}
          <IconButton
            onClick={handleOpenMobileMenu}
            sx={{ display: { xs: "inline-flex", md: "none" }, color: "#fff" }}
            aria-label="เปิดเมนู"
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={mobileMenuAnchor}
            open={isMobileMenuOpen}
            onClose={handleCloseMobileMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {isSuperAdmin && (
              <MenuItem onClick={() => handleNavigateMobile("/drrs/admin/user-management")}>
                จัดการสิทธิ์ผู้ใช้
              </MenuItem>
            )}
            {isAdmin && (
              <MenuItem onClick={() => handleNavigateMobile("/drrs/admin/master-import")}>
                นำเข้าข้อมูล: MasterData
              </MenuItem>
            )}
            {isAdmin && (
              <MenuItem onClick={() => handleNavigateMobile("/drrs/admin/target-import")}>
                นำเข้าข้อมูล: ข้อมูลชี้เป้า
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={() => handleNavigateMobile("/drrs/admin/contract-reprint")}>
              Reprint สัญญา
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                handleCloseMobileMenu();
                handleLogout();
              }}
            >
              ออกจากระบบ
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default AdminNavbar;
