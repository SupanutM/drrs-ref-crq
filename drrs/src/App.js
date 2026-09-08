/**
=========================================================
* Material Kit 2 React - v2.1.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-kit-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useEffect } from "react";

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// @mui material components
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Material Kit 2 React themes
import theme from "assets/theme";
// Import Page
import ConsentPage from "layouts/pages/landing-pages/consent";
import FormRegisterPage from "layouts/pages/landing-pages/form-register";
import LoanPlanPage from "layouts/pages/landing-pages/loan-plan";
import LoanPlanDetailPage from "layouts/pages/landing-pages/loan-plan-detail";
import GenContractPage from "layouts/pages/landing-pages/gen-contract"
import PlanPreviewPage from "layouts/pages/landing-pages/plan-preview";
import SelectPlanPage from "layouts/pages/landing-pages/select-plan";
import PlanSummaryPage from "layouts/pages/landing-pages/plan-summary";
import AdminLoginPage from "layouts/pages/landing-pages/admin-login";
import AdminMasterImportPage from "layouts/pages/landing-pages/admin-master-import";
import AdminTargetImportPage from "layouts/pages/landing-pages/admin-target-import";
import AdminContractReprintPage from "layouts/pages/landing-pages/admin-contract-reprint";
import AdminUserManagePage from "layouts/pages/landing-pages/admin-user-manage";

// Session Guard
import SessionGuard from "components/SessionGuard/SessionGuardComponent";
import AdminGuard from "components/AdminGuard/AdminGuardComponent";
import { getAdminToken } from "utils/adminAuthToken";

// Material Kit 2 React routes
import routes from "routes";

// Deeplink ทางเข้าเฉพาะฝั่ง admin (/drrs/admin) — แยกจากทางเข้าลูกค้า (/drrs/consent)
// ถ้ามี admin token อยู่แล้ว (login ค้างไว้) พาไปหน้าแรกของ admin ตรงๆ ไม่ต้อง login ซ้ำ
// ถ้ายังไม่มี token พาไปหน้า login ก่อน
// หน้าแรกของ admin คือหน้า reprint สัญญาเสมอ ไม่ว่า role จะเป็นอะไรก็ตาม (ADMIN/SUPERADMIN ที่ต้อง
// เข้าหน้านำเข้าข้อมูลให้ไปกดเมนู "นำเข้าข้อมูล" บน AdminNavbar เอง ไม่ auto-redirect ให้แล้ว)
function AdminEntry() {
  const hasToken = !!getAdminToken();
  if (!hasToken) {
    return <Navigate to="/drrs/admin/login" replace />;
  }
  return <Navigate to="/drrs/admin/contract-reprint" replace />;
}

export default function App() {
  const { pathname } = useLocation();

  // Setting page scroll to 0 when changing the route
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }

      if (route.route) {
        return <Route exact path={route.route} element={route.component} key={route.key} />;
      }

      return null;
    });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        {getRoutes(routes)}
        <Route path="/" element={<Navigate to="/drrs/consent" />} />
        <Route path="/drrs/consent" element={<ConsentPage />} />
        <Route path="/drrs/form" element={<SessionGuard><FormRegisterPage /></SessionGuard>} />
        <Route path="/drrs/plan" element={<SessionGuard><LoanPlanPage /></SessionGuard>} />
        <Route path="/drrs/plan-detail" element={<SessionGuard><LoanPlanDetailPage /></SessionGuard>} />
        <Route path="/drrs/plan-preview" element={<SessionGuard><PlanPreviewPage /></SessionGuard>} />
        <Route path="/drrs/select-plan" element={<SessionGuard><SelectPlanPage /></SessionGuard>} />
        <Route path="/drrs/plan-summary" element={<SessionGuard><PlanSummaryPage /></SessionGuard>} />
        <Route path="/drrs/contract" element={<SessionGuard><GenContractPage /></SessionGuard>} />

        <Route path="/drrs/admin" element={<AdminEntry />} />
        <Route path="/drrs/admin/login" element={<AdminLoginPage />} />
        <Route path="/drrs/admin/master-import" element={<AdminGuard requireAdmin><AdminMasterImportPage /></AdminGuard>} />
        <Route path="/drrs/admin/target-import" element={<AdminGuard requireAdmin><AdminTargetImportPage /></AdminGuard>} />
        <Route path="/drrs/admin/contract-reprint" element={<AdminGuard><AdminContractReprintPage /></AdminGuard>} />
        <Route path="/drrs/admin/user-management" element={<AdminGuard requireSuperAdmin><AdminUserManagePage /></AdminGuard>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ThemeProvider>
  );
}
