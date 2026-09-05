import React from "react";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import AdminNavbar from "components/AdminNavbar";

import AdminUserManageController from "./page/controller/AdminUserManageController";

function AdminUserManage() {
  return (
    <MKBox sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa" }}>
      <AdminNavbar />

      <Container sx={{ py: 4 }}>
        <Card sx={{ p: { xs: 2, md: 4 }, boxShadow: ({ boxShadows: { xxl } }) => xxl }}>
          <AdminUserManageController />
        </Card>
      </Container>
    </MKBox>
  );
}

export default AdminUserManage;
