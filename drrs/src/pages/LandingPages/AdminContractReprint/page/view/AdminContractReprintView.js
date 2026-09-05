import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Pagination from "@mui/material/Pagination";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKInput from "components/MKInput";
import MKButton from "components/MKButton";
import MKAlert from "components/MKAlert";

import { formatThaiDate } from "utils/day";

// สัดส่วนคอลัมน์ของตาราง — ประกาศไว้ที่เดียว ใช้ทั้ง header และทุกแถวข้อมูล
// เพื่อให้หัวตารางกับข้อมูลตรงกันเสมอ 100% (ไม่พึ่ง <table> ที่ browser จะคำนวณความกว้าง
// คอลัมน์เองจากเนื้อหา ซึ่งเคยทำให้หัวตารางเลื่อนไม่ตรงกับข้อมูลตอนเนื้อหาสั้น/ยาวไม่เท่ากัน)
// ลำดับ: วันที่สร้างสัญญา, ชื่อลูกค้า, ชื่อไฟล์, บัญชี/แผน, ดำเนินการ
const GRID_COLUMNS = "20% 15% 25% 20% 20%";

// จำนวนแถวต่อหน้าของตารางผลการค้นหา — แบ่งหน้าฝั่ง frontend (client-side)
const PAGE_SIZE = 10;

function AdminContractReprintView({ state, handlers }) {
  const {
    citizenId,
    accountNo,
    firstName,
    lastName,
    results,
    isAlert,
    alertMsg,
    alertType,
    isLoading,
    downloadingId,
    page,
  } = state;
  const {
    handleChangeCitizenId,
    handleChangeAccountNo,
    handleChangeFirstName,
    handleChangeLastName,
    handleSearch,
    handleClear,
    handleKeyDown,
    handleDownload,
    handlePageChange,
  } = handlers;

  // ตัดเอาแค่แถวของหน้าปัจจุบันมาแสดง (ผลค้นหาทั้งหมดยังอยู่ใน results เดิม ไม่ได้ยิง API ใหม่)
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pagedResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} md={10}>
        <MKBox mb={3}>
          <MKTypography variant="h4" fontWeight="bold" color="dark">
            ค้นหาสัญญาเพื่อ Reprint
          </MKTypography>
          <MKTypography variant="body2" color="text" mt={1}>
            ค้นหาด้วยเลขบัตรประชาชน เลขบัญชี ชื่อ หรือนามสกุล อย่างใดอย่างหนึ่งหรือรวมกันก็ได้
          </MKTypography>
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

        {/* บรรทัดที่ 1: เลขบัตรประชาชน / เลขบัญชี */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} sm={6}>
            <MKInput
              type="text"
              label="เลขบัตรประชาชน"
              fullWidth
              value={citizenId}
              onChange={handleChangeCitizenId}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MKInput
              type="text"
              label="เลขบัญชี"
              fullWidth
              value={accountNo}
              onChange={handleChangeAccountNo}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </Grid>
        </Grid>

        {/* บรรทัดที่ 2: ชื่อ / นามสกุล */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} sm={6}>
            <MKInput
              type="text"
              label="ชื่อ"
              fullWidth
              value={firstName}
              onChange={handleChangeFirstName}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MKInput
              type="text"
              label="นามสกุล"
              fullWidth
              value={lastName}
              onChange={handleChangeLastName}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </Grid>
        </Grid>

        {/* บรรทัดที่ 3: ปุ่มค้นหา / ล้างข้อมูล (กึ่งกลาง) */}
        <Grid container spacing={2} justifyContent="center" mb={3}>
          <Grid item xs={6} sm={3}>
            <MKButton
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={handleClear}
              disabled={isLoading}
            >
              ล้างข้อมูล
            </MKButton>
          </Grid>
          <Grid item xs={6} sm={3}>
            <MKButton variant="gradient" color="primary" fullWidth onClick={handleSearch} disabled={isLoading}>
              {isLoading ? "กำลังค้นหา..." : "ค้นหา"}
            </MKButton>
          </Grid>
        </Grid>

        {results.length > 0 && (
          <MKBox component={Paper} sx={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
            {/* หัวตาราง — ใช้ CSS Grid คอลัมน์เดียวกับทุกแถวข้อมูลด้านล่าง (GRID_COLUMNS ตัวเดียวกัน)
                การันตีว่าหัวตารางตรงกับข้อมูลเสมอ ไม่ว่าเนื้อหาแต่ละคอลัมน์จะสั้น/ยาวแค่ไหน */}
            <MKBox
              sx={{
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                backgroundColor: "#f8f9fa",
                borderBottom: "1px solid #e0e0e0",
                px: 2,
                py: 1.2,
              }}
            >
              <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
                วันที่สร้างสัญญา
              </MKTypography>
              <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
                ชื่อลูกค้า
              </MKTypography>
              <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
                ชื่อไฟล์
              </MKTypography>
              <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
                บัญชี / แผน
              </MKTypography>
              <MKTypography variant="button" fontWeight="bold" color="dark" textAlign="center">
                ดำเนินการ
              </MKTypography>
            </MKBox>

            {/* แถวข้อมูล — gridTemplateColumns เดียวกับหัวตารางเป๊ะๆ */}
            {pagedResults.map((row, index) => (
              <MKBox
                key={row.contractFileId}
                sx={{
                  display: "grid",
                  gridTemplateColumns: GRID_COLUMNS,
                  alignItems: "center",
                  px: 2,
                  py: 1.2,
                  borderBottom: index < pagedResults.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <MKTypography variant="body2" textAlign="center">
                  {formatThaiDate(row.createdDate, "-")}
                </MKTypography>
                <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {row.customerName || "-"}
                </MKTypography>
                <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {row.fileName}
                </MKTypography>
                <MKBox>
                  {row.accounts.map((acc) => (
                    <Chip
                      key={`${row.contractFileId}-${acc.accountNo}-${acc.planNo}`}
                      size="small"
                      label={`${acc.accountNo} (แผน ${acc.planNo})`}
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </MKBox>
                <MKBox textAlign="center">
                  <MKButton
                    variant="outlined"
                    color="info"
                    size="small"
                    onClick={() => handleDownload(row.contractFileId)}
                    disabled={downloadingId === row.contractFileId}
                  >
                    {downloadingId === row.contractFileId ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}
                  </MKButton>
                </MKBox>
              </MKBox>
            ))}
          </MKBox>
        )}

        {/* แสดง pagination เฉพาะตอนผลค้นหามีมากกว่า 1 หน้า — กันโชว์เปล่าๆตอนผลลัพธ์น้อย */}
        {results.length > PAGE_SIZE && (
          <MKBox mt={2} display="flex" justifyContent="center">
            <Pagination count={pageCount} page={page} onChange={handlePageChange} color="primary" />
          </MKBox>
        )}
      </Grid>
    </Grid>
  );
}

AdminContractReprintView.propTypes = {
  state: PropTypes.shape({
    citizenId: PropTypes.string.isRequired,
    accountNo: PropTypes.string.isRequired,
    firstName: PropTypes.string.isRequired,
    lastName: PropTypes.string.isRequired,
    results: PropTypes.arrayOf(
      PropTypes.shape({
        contractFileId: PropTypes.number,
        fileName: PropTypes.string,
        createdDate: PropTypes.string,
        customerName: PropTypes.string,
        accounts: PropTypes.array,
      })
    ).isRequired,
    isAlert: PropTypes.bool.isRequired,
    alertMsg: PropTypes.string.isRequired,
    alertType: PropTypes.string.isRequired,
    isLoading: PropTypes.bool.isRequired,
    downloadingId: PropTypes.number,
    page: PropTypes.number.isRequired,
  }).isRequired,
  handlers: PropTypes.shape({
    handleChangeCitizenId: PropTypes.func.isRequired,
    handleChangeAccountNo: PropTypes.func.isRequired,
    handleChangeFirstName: PropTypes.func.isRequired,
    handleChangeLastName: PropTypes.func.isRequired,
    handleSearch: PropTypes.func.isRequired,
    handleClear: PropTypes.func.isRequired,
    handleKeyDown: PropTypes.func.isRequired,
    handleDownload: PropTypes.func.isRequired,
    handlePageChange: PropTypes.func.isRequired,
  }).isRequired,
};

export default AdminContractReprintView;
