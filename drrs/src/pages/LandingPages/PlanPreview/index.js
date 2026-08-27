import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

// Material Kit 2 React examples
import DefaultNavbar from "examples/Navbars/DefaultNavbar";

// Page Sections
import PlanPreviewController from "pages/LandingPages/PlanPreview/page/controller/PlanPreviewController";

// Routes
import { useLocation } from "react-router-dom";
import routes from "routes";

function PlanPreview() {
  const location = useLocation();
  const routerState = location.state;

  return (
    <MKBox sx={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      <DefaultNavbar
        routes={routes}
        action={{
          type: "external",
          route: "https://ln15.gsb.or.th/drrs",
          label: "GSB DRRS Website",
          color: "default",
        }}
        backRoute
        transparent
        light
      />

      {/* แบนเนอร์สีฟ้าด้านบน */}
      <MKBox sx={{ minHeight: { xs: "180px", md: "35vh" }, flexShrink: 0, width: "100%", backgroundColor: "#eb3a75", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", pt: { xs: "50px", md: "64px" }, pb: { xs: 5, md: 4 } }} >
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

      {/* กล่อง Card สีขาวที่ครอบ Form ทั้งหมด */}
      <Card sx={{ mx: { xs: 2, lg: 3 }, mt: -6, mb: 2, pt: 4, pb: 4, boxShadow: ({ boxShadows: { xxl } }) => xxl, flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
        <Container sx={{ minHeight: "500px" }}>
          {/* เรียกใช้งาน Controller และส่ง routerState ไปให้ */}
          <PlanPreviewController routerState={routerState} />

        </Container>
      </Card>
    </MKBox>
  );
}

export default PlanPreview;
