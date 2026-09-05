import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";

/**
 * AdminFileUploadRow
 * แถวเลือกไฟล์ .xlsx 1 ไฟล์ พร้อมแสดงชื่อไฟล์ที่เลือกและผลลัพธ์ import (ถ้ามี)
 * ใช้ร่วมกันทั้งหน้า MasterImport (จังหวัด/อำเภอ/ตำบล) และ TargetImport (ลูกค้า/บัญชี/แผน)
 */
function AdminFileUploadRow({ label, hint, file, onFileChange, result }) {
  const inputId = `file-input-${label}`;

  return (
    <MKBox
      sx={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        p: 2,
        mb: 2,
      }}
    >
      <Grid container alignItems="center" spacing={2}>
        <Grid item xs={12} sm={4}>
          <MKTypography variant="body2" fontWeight="bold" color="dark">
            {label}
          </MKTypography>
          {hint && (
            <MKTypography variant="caption" color="text">
              {hint}
            </MKTypography>
          )}
        </Grid>

        <Grid item xs={12} sm={4}>
          <MKButton
            component="label"
            variant="outlined"
            color="info"
            size="small"
            fullWidth
          >
            {file ? "เปลี่ยนไฟล์" : "เลือกไฟล์ .xlsx / .csv"}
            <input
              id={inputId}
              type="file"
              accept=".xlsx,.csv"
              hidden
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            />
          </MKButton>
          {file && (
            <MKTypography variant="caption" color="text" display="block" mt={0.5} noWrap>
              {file.name}
            </MKTypography>
          )}
        </Grid>

        <Grid item xs={12} sm={4}>
          {result && (
            <MKBox>
              <Chip
                size="small"
                label={result.success ? "สำเร็จ" : "ล้มเหลว"}
                color={result.success ? "success" : "error"}
                sx={{ mb: 0.5 }}
              />
              <MKTypography variant="caption" color="text" display="block">
                {result.message}
              </MKTypography>
              {result.data?.errors?.length > 0 && (
                <MKTypography variant="caption" color="error" display="block">
                  พบข้อผิดพลาด {result.data.errors.length} แถว
                </MKTypography>
              )}
            </MKBox>
          )}
        </Grid>
      </Grid>
    </MKBox>
  );
}

AdminFileUploadRow.defaultProps = {
  hint: "",
  file: null,
  result: null,
};

AdminFileUploadRow.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  file: PropTypes.shape({ name: PropTypes.string }),
  onFileChange: PropTypes.func.isRequired,
  result: PropTypes.shape({
    success: PropTypes.bool,
    message: PropTypes.string,
    data: PropTypes.shape({
      errors: PropTypes.arrayOf(PropTypes.string),
    }),
  }),
};

export default AdminFileUploadRow;
