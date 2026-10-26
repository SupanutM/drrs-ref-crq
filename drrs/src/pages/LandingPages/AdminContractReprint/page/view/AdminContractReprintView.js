import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
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

/**
 * สีของ chip บัญชี — ต้องแยกให้ชัดว่าบัญชีไหน "อยู่ในไฟล์สัญญาจริง"
 * เพราะ tbl_contract_file_account เก็บบัญชีที่ CBS ปฏิเสธไว้ด้วย (ไว้ตรวจย้อนหลังว่ายื่นอะไรมา)
 * แต่ไฟล์ PDF มีแค่บัญชีที่ CBS รับ — ถ้าโชว์เหมือนกันหมด admin จะเข้าใจผิดว่าบัญชีที่ถูกปฏิเสธ
 * อยู่ในสัญญาด้วย (isInContract มาจาก backend: true/false/null)
 *   success = CBS รับ อยู่ในไฟล์สัญญา
 *   error   = CBS ปฏิเสธ ไม่อยู่ในไฟล์สัญญา
 *   default = ไม่มีข้อมูลสถานะ (สัญญาเก่าก่อนเก็บ cbs_status) ไม่ตัดสินแทน
 */
const chipColorOf = (acc) => {
  if (acc.isInContract === true) return "success";
  if (acc.isInContract === false) return "error";
  return "default";
};

const chipTooltipOf = (acc) => {
  if (acc.isInContract === true) return "CBS ลงทะเบียนสำเร็จ — บัญชีนี้อยู่ในไฟล์สัญญา";
  if (acc.isInContract === false) {
    const reason = acc.cbsDesc || acc.cbsStatus || "ไม่มีคำอธิบาย";
    return `CBS ไม่รับบัญชีนี้ จึงไม่อยู่ในไฟล์สัญญา — ${reason}`;
  }
  return "ไม่มีข้อมูลสถานะจาก CBS (สัญญาที่สร้างไว้ก่อนเริ่มเก็บสถานะ)";
};

/** รายการ chip บัญชี/แผน — ใช้ทั้งตารางจอใหญ่และการ์ดจอเล็ก ให้แสดงผลตรงกันเสมอ */
function AccountChips({ contractFileId, accounts }) {
  return (
    <>
      {accounts.map((acc, i) => (
        <Tooltip key={`${contractFileId}-${acc.accountNo}-${acc.planNo}-${i}`} title={chipTooltipOf(acc)}>
          <Chip
            size="small"
            color={chipColorOf(acc)}
            label={`${acc.accountNo} (แผน ${acc.planNo})`}
            sx={{ mr: 0.5, mb: 0.5 }}
          />
        </Tooltip>
      ))}
    </>
  );
}

AccountChips.propTypes = {
  contractFileId: PropTypes.number.isRequired,
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      accountNo: PropTypes.string,
      planNo: PropTypes.string,
      cbsStatus: PropTypes.string,
      cbsDesc: PropTypes.string,
      isInContract: PropTypes.bool,
    })
  ).isRequired,
};

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
          <>
            {/* จอ lg ขึ้นไป: ตาราง CSS Grid แบบเดิม (คอลัมน์กว้างพอ อ่านง่าย)
                ใช้ lg (992px) ไม่ใช่ md (768px) เพราะตาราง 5 คอลัมน์ต้องการที่กว้างจริง
                ช่วง 768-992px คอลัมน์ยังบี้กันอ่านไม่ออก */}
            <MKBox
              component={Paper}
              sx={{
                display: { xs: "none", lg: "block" },
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                overflowY: "auto",
                maxHeight: "500px",
              }}
            >
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
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
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
                    <AccountChips contractFileId={row.contractFileId} accounts={row.accounts} />
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

            {/* จอเล็ก/มือถือ (ต่ำกว่า lg): แสดงเป็นการ์ดทีละแถว แทนตาราง CSS Grid ที่คอลัมน์บี้กันจนอ่านไม่ออก
                ข้อมูลชุดเดียวกับตารางด้านบน แค่สลับการจัดวางเป็นแนวตั้ง (label ซ้าย ค่าขวา) */}
            <MKBox sx={{ display: { xs: "block", lg: "none" } }}>
              {pagedResults.map((row) => (
                <MKBox
                  key={row.contractFileId}
                  component={Paper}
                  sx={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    p: 2,
                    mb: 1.5,
                  }}
                >
                  <MKBox display="flex" justifyContent="space-between" mb={1}>
                    <MKTypography variant="caption" color="text">
                      วันที่สร้างสัญญา
                    </MKTypography>
                    <MKTypography variant="body2" fontWeight="medium">
                      {formatThaiDate(row.createdDate, "-")}
                    </MKTypography>
                  </MKBox>
                  <MKBox mb={1}>
                    <MKTypography variant="caption" color="text">
                      ชื่อลูกค้า
                    </MKTypography>
                    <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                      {row.customerName || "-"}
                    </MKTypography>
                  </MKBox>
                  <MKBox mb={1}>
                    <MKTypography variant="caption" color="text">
                      ชื่อไฟล์
                    </MKTypography>
                    <MKTypography variant="body2" sx={{ wordBreak: "break-word" }}>
                      {row.fileName}
                    </MKTypography>
                  </MKBox>
                  <MKBox mb={1.5}>
                    <MKTypography variant="caption" color="text" display="block" mb={0.5}>
                      บัญชี / แผน
                    </MKTypography>
                    <AccountChips contractFileId={row.contractFileId} accounts={row.accounts} />
                  </MKBox>
                  <MKButton
                    variant="outlined"
                    color="info"
                    size="small"
                    fullWidth
                    onClick={() => handleDownload(row.contractFileId)}
                    disabled={downloadingId === row.contractFileId}
                  >
                    {downloadingId === row.contractFileId ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}
                  </MKButton>
                </MKBox>
              ))}
            </MKBox>
          </>
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
