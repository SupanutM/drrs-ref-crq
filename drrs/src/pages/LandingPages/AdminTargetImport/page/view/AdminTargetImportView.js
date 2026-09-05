import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import MKAlert from "components/MKAlert";
import AdminFileUploadRow from "components/AdminFileUploadRow";

function AdminTargetImportView({ state, handlers }) {
  const { files, results, isAlert, alertMsg, alertType, isLoading } = state;
  const { handleFileChange, handleSubmit } = handlers;

  const hasAnyFile = !!(files.customer || files.account || files.plan);

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} md={9}>
        <MKBox mb={3}>
          <MKTypography variant="h4" fontWeight="bold" color="dark">
            นำเข้าข้อมูลชี้เป้า (ลูกค้า / บัญชี / แผน)
          </MKTypography>
          {/* <MKTypography variant="body2" color="text" mt={1}>
            รองรับเฉพาะไฟล์ .csv (pipe-delimited &quot;|&quot;, encoding Windows-874, ไม่มีบรรทัด header)
            ต้องนำเข้า &quot;ไฟล์ข้อมูลลูกค้า&quot; ก่อนเสมอ ถ้าจะนำเข้า &quot;ไฟล์ข้อมูลบัญชี&quot;
            พร้อมกัน (บัญชีต้องอ้างอิง CIF_NO ที่มีอยู่ในระบบแล้ว) ส่วนไฟล์ข้อมูลแผนนำเข้าแยกได้อิสระ
          </MKTypography> */}
        </MKBox>

        {isAlert && (
          <Fade in={isAlert}>
            <MKBox mb={2}>
              <MKAlert color={alertType} dismissible>
                {alertMsg}
              </MKAlert>
            </MKBox>
          </Fade>
        )}

        <AdminFileUploadRow
          label="ข้อมูลลูกค้า"
          hint="ลำดับคอลัมน์: CIF_NO | CITIZEN_ID | NAME | LNAME | VERIFY_CODE | TYPE"
          file={files.customer}
          onFileChange={(f) => handleFileChange("customer", f)}
          result={results.customer}
        />
        <AdminFileUploadRow
          label="ข้อมูลบัญชี"
          hint="ลำดับคอลัมน์: ACCOUNT_NO | CIF_NO | PLAN_NO | PAYMENT_AMOUNT | INSTALLMENT_TERMS"
          file={files.account}
          onFileChange={(f) => handleFileChange("account", f)}
          result={results.account}
        />
        <AdminFileUploadRow
          label="ข้อมูลแผน"
          hint="ลำดับคอลัมน์: CODE | LOAN_TYPE | DESC_TH | DESC_EN | CHECK_INCOME"
          file={files.plan}
          onFileChange={(f) => handleFileChange("plan", f)}
          result={results.plan}
        />

        <MKBox mt={3} textAlign="right">
          <MKButton
            variant="gradient"
            color="primary"
            onClick={handleSubmit}
            disabled={isLoading || !hasAnyFile}
          >
            {isLoading ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
          </MKButton>
        </MKBox>
      </Grid>
    </Grid>
  );
}

AdminTargetImportView.propTypes = {
  state: PropTypes.shape({
    files: PropTypes.shape({
      customer: PropTypes.shape({ name: PropTypes.string }),
      account: PropTypes.shape({ name: PropTypes.string }),
      plan: PropTypes.shape({ name: PropTypes.string }),
    }).isRequired,
    results: PropTypes.object.isRequired,
    isAlert: PropTypes.bool.isRequired,
    alertMsg: PropTypes.string.isRequired,
    alertType: PropTypes.string.isRequired,
    isLoading: PropTypes.bool.isRequired,
  }).isRequired,
  handlers: PropTypes.shape({
    handleFileChange: PropTypes.func.isRequired,
    handleSubmit: PropTypes.func.isRequired,
  }).isRequired,
};

export default AdminTargetImportView;
