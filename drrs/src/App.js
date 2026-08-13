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

// Session Guard
import SessionGuard from "components/SessionGuard/SessionGuardComponent";

// Material Kit 2 React routes
import routes from "routes";

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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ThemeProvider>
  );
}
