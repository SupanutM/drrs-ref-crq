import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import MKAlert from "components/MKAlert";
import AdminFileUploadRow from "components/AdminFileUploadRow";

function AdminMasterImportView({ state, handlers }) {
  const { files, results, isAlert, alertMsg, alertType, isLoading } = state;
  const { handleFileChange, handleSubmit } = handlers;

  const hasAnyFile = !!(files.province || files.district || files.subDistrict);

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} md={9}>
        <MKBox mb={3}>
          <MKTypography variant="h4" fontWeight="bold" color="dark">
            นำเข้าข้อมูล Master (จังหวัด / อำเภอ / ตำบล)
          </MKTypography>
          {/* <MKTypography variant="body2" color="text" mt={1}>
            เลือกไฟล์ .xlsx ได้สูงสุด 3 ไฟล์ (เลือกเฉพาะไฟล์ที่ต้องการนำเข้าก็ได้) ระบบจะอัปเดตข้อมูลตามรหัสที่ตรงกัน
            และเพิ่มข้อมูลใหม่ถ้ายังไม่มีในระบบ
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
          label="จังหวัด (Province)"
          hint="คอลัมน์ที่ต้องมี: LANG, PROVINCE_CODE, PROVINCE_NAME"
          file={files.province}
          onFileChange={(f) => handleFileChange("province", f)}
          result={results.province}
        />
        <AdminFileUploadRow
          label="อำเภอ (District)"
          hint="คอลัมน์ที่ต้องมี: LANG, PROVINCE_CODE, DISTRICT_CODE, DISTRICT_NAME"
          file={files.district}
          onFileChange={(f) => handleFileChange("district", f)}
          result={results.district}
        />
        <AdminFileUploadRow
          label="ตำบล (Sub-District)"
          hint="คอลัมน์ที่ต้องมี: LANG, PROVINCE_CODE, DISTRICT_CODE, SUB_DISTRICT_CODE, SUB_DISTRICT_NAME"
          file={files.subDistrict}
          onFileChange={(f) => handleFileChange("subDistrict", f)}
          result={results.subDistrict}
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

AdminMasterImportView.propTypes = {
  state: PropTypes.shape({
    files: PropTypes.shape({
      province: PropTypes.shape({ name: PropTypes.string }),
      district: PropTypes.shape({ name: PropTypes.string }),
      subDistrict: PropTypes.shape({ name: PropTypes.string }),
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

export default AdminMasterImportView;
