import React from "react";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import AdminNavbar from "components/AdminNavbar";

import AdminTargetImportController from "./page/controller/AdminTargetImportController";

function AdminTargetImport() {
  return (
    <MKBox sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa" }}>
      <AdminNavbar />

      <Container sx={{ py: 4 }}>
        <Card sx={{ p: { xs: 2, md: 4 }, boxShadow: ({ boxShadows: { xxl } }) => xxl }}>
          <AdminTargetImportController />
        </Card>
      </Container>
    </MKBox>
  );
}

export default AdminTargetImport;
