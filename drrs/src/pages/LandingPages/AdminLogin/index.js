import React from "react";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

import DefaultNavbar from "examples/Navbars/DefaultNavbar";
import routes from "routes";

import AdminLoginController from "./page/controller/AdminLoginController";

function AdminLogin() {
  return (
    <MKBox sx={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <DefaultNavbar routes={routes} transparent light />

      {/* ใช้สี primary ของธีม DRRS (#eb3a75) แทนสี dark เดิม ให้ตรงกับแถบหัวของหน้าลูกค้าปกติ (เช่นหน้า Consent) */}
      <MKBox
        sx={{
          minHeight: { xs: "160px", md: "25vh" },
          flexShrink: 0,
          width: "100%",
          backgroundColor: "#eb3a75",
          display: "flex",
          alignItems: "center",
          pt: { xs: "50px", md: "64px" },
          pb: { xs: 5, md: 4 },
        }}
      >
        <Container>
          <Grid container item xs={12} lg={8} justifyContent="center" alignItems="center" flexDirection="column" sx={{ mx: "auto", textAlign: "center" }}>
            <MKTypography variant="h3" color="white">
              DRRS ADMIN
            </MKTypography>
          </Grid>
        </Container>
      </MKBox>

      <Card sx={{ mx: { xs: 2, lg: 3 }, mt: -6, mb: 2, pt: 4, pb: 4, boxShadow: ({ boxShadows: { xxl } }) => xxl, flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
        <Container sx={{ minHeight: "400px" }}>
          <AdminLoginController />
        </Container>
      </Card>
    </MKBox>
  );
}

export default AdminLogin;
