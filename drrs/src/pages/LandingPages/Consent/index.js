import React, { useState } from "react";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
// import MKButton from "components/MKButton";

// Material Kit 2 React examples
import DefaultNavbar from "examples/Navbars/DefaultNavbar";

// Page Sections
import ConsentController from "pages/LandingPages/Consent/page/controller/ConsentController";

// Routes
import routes from "routes";

function Consent() {
  const [appVersion, setAppVersion] = useState("1.0.0");

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
          <ConsentController onVersionLoad={setAppVersion} />
        </Container>
      </Card>

      <MKBox textAlign="center">
        <MKTypography variant="caption" color="text" opacity={0.5}>
          GSB DRRS System • {appVersion}
        </MKTypography>
      </MKBox>
    </MKBox>
  );
}

export default Consent;
