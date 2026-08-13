import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// @mui material components
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

// Material Kit 2 React examples
import DefaultNavbar from "examples/Navbars/DefaultNavbar";
import routes from "routes";

// ==========================================
// นำเข้า Controller ทั้ง 2 แบบ
// ==========================================
import IndividualFormController from "./page/controller/IndividualFormController";
import JuristicFormController from "./page/controller/JuristicFormController";
import IncomeModalComponent from "components/IncomeModal";

function FormRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state;

  // State สำหรับเก็บประเภทบุคคล (เริ่มต้นที่ บุคคลธรรมดา)
  const [custType, setCustType] = useState("บุคคลธรรมดา");

  // State สำหรับ Income Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetInfo, setTargetInfo] = useState(null);

  const handleVerifySuccess = (info) => {
    setTargetInfo(info);
    setIsModalOpen(true);
  };

  const handleIncomeSaveSuccess = (payload) => {
    setIsModalOpen(false);
    navigate("/drrs/plan-preview", {
      state: {
        targetInfo: {
          ...targetInfo,
          totalIncome: payload.totalIncome,
          otherIncome: payload.otherIncome,
          totalCost: payload.totalCost,
          netIncome: payload.netIncome
        }
      }
    });
  };

  // ตรวจสอบการเข้าถึงหน้าเว็บผ่าน Consent
  useEffect(() => {
    if (!routerState) {
      navigate("/ndrs-gsb-register/consent", { replace: true });
    }
  }, [navigate, routerState]);

  if (!routerState) {
    return null;
  }

  return (
    <MKBox sx={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      <DefaultNavbar
        routes={routes}
        action={{
          type: "external",
          route: "https://ln15.gsb.or.th/ndrs",
          label: "GSB NDRS Website",
          color: "default",
        }}
        backRoute="/drrs/consent"
        transparent
        light
      />

      <MKBox sx={{ minHeight: { xs: "280px", md: "35vh" }, flexShrink: 0, width: "100%", backgroundColor: "#eb3a75", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", pt: { xs: "60px", md: "64px" }, pb: { xs: 3, md: 4 } }} >
        <Container>
          <Grid container item xs={12} lg={8} justifyContent="center" alignItems="center" flexDirection="column" sx={{ mx: "auto", textAlign: "center" }} >
            <MKTypography
              variant="h2"
              color="white"
              sx={({ breakpoints, typography: { size } }) => ({
                fontSize: size["2xl"],
                [breakpoints.down("md")]: {
                  fontSize: size["xl"],
                },
              })}
            >
              ลงทะเบียนขอปรับปรุงโครงสร้างหนี้
              {/* <br />
              ผ่อนปรนเงื่อนไขการชำระหนี้ */}
            </MKTypography>
            {/* <MKTypography variant="h5" color="white" opacity={1} mt={1} mb={3} sx={({ breakpoints, typography: { size } }) => ({ [breakpoints.down("md")]: { fontSize: size["md"] } })}>
              ผ่านช่องทาง Digital
            </MKTypography> */}
          </Grid>
        </Container>
      </MKBox>

      <Card sx={{ mx: { xs: 2, lg: 3 }, mt: -6, mb: 2, pt: 4, pb: 4, boxShadow: ({ boxShadows: { xxl } }) => xxl, flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
        <Container sx={{ minHeight: "500px" }}>
          {/* <Grid container justifyContent="center" >
            <MKTypography variant="h5" color="primary" align="center">
              ระบุข้อมูลสำหรับการลงทะเบียน
            </MKTypography>
          </Grid> */}

          <Grid container item xs={12}>
            <FormControl component="fieldset">
              <MKTypography variant="body2" fontWeight="bold" color="dark" mb={0.5}>
                ประเภทบุคคล
              </MKTypography>
              <RadioGroup row value={custType} onChange={(e) => setCustType(e.target.value)} sx={{ alignItems: "center" }}>
                <FormControlLabel value="บุคคลธรรมดา" control={<Radio sx={{ p: 0.5, mr: 0.5 }} />} label={<MKTypography variant="body2" color="dark">บุคคลธรรมดา</MKTypography>} sx={{ mr: 2, ml: 0, display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "center" }} />
                <FormControlLabel value="นิติบุคคล" control={<Radio sx={{ p: 0.5, mr: 0.5 }} />} label={<MKTypography variant="body2" color="dark">นิติบุคคล</MKTypography>} sx={{ mr: 0, ml: 0, display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "center" }} />
              </RadioGroup>
            </FormControl>
          </Grid>

          {custType === "บุคคลธรรมดา" ? (
            <IndividualFormController consentFlag={routerState.consentFlag} onVerifySuccess={handleVerifySuccess} />
          ) : (
            <JuristicFormController consentFlag={routerState.consentFlag} onVerifySuccess={handleVerifySuccess} />
          )}

          <IncomeModalComponent
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={handleIncomeSaveSuccess}
            cusTargetId={targetInfo?.cusTargetId}
            initialData={targetInfo}
          />

        </Container>
      </Card>
    </MKBox>
  );
}

export default FormRegister;