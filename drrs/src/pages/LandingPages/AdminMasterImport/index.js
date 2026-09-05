import React from "react";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";

import MKBox from "components/MKBox";
import AdminNavbar from "components/AdminNavbar";

import AdminMasterImportController from "./page/controller/AdminMasterImportController";

function AdminMasterImport() {
  return (
    <MKBox sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa" }}>
      <AdminNavbar />

      <Container sx={{ py: 4 }}>
        <Card sx={{ p: { xs: 2, md: 4 }, boxShadow: ({ boxShadows: { xxl } }) => xxl }}>
          <AdminMasterImportController />
        </Card>
      </Container>
    </MKBox>
  );
}

export default AdminMasterImport;
