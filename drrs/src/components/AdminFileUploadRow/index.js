import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";

// จำนวนรายการ "แถวซ้ำ" ที่โชว์บนหน้าจอ ที่เหลือสรุปเป็น "และอีก N รายการ" (รายละเอียดครบอยู่ใน
// tbl_admin_system_log) — กันกล่องผลลัพธ์ยืดยาวจนอ่านไม่ไหวถ้าไฟล์มีแถวซ้ำเยอะ
const WARNING_PREVIEW_COUNT = 3;

/**
 * AdminFileUploadRow
 * แถวเลือกไฟล์ 1 ไฟล์ พร้อมแสดงชื่อไฟล์ที่เลือกและผลลัพธ์ import (ถ้ามี)
 * ใช้ร่วมกันทั้งหน้า MasterImport (จังหวัด/อำเภอ/ตำบล) และ TargetImport (ลูกค้า/บัญชี/แผน)
 *
 * ★ นามสกุลที่รับต้องส่งมาทาง prop `accept` เสมอ — สองหน้านี้รับไฟล์ไม่เหมือนกัน
 *   (master data รับ .xlsx/.csv แต่ target data รับ .csv เท่านั้น เพราะไฟล์ที่ผ่านการแปลงเป็น
 *   Excel มาก่อนทำเลขบัตรประชาชนเพี้ยน) เดิม hardcode ".xlsx,.csv" ไว้ในคอมโพเนนต์นี้ ทำให้ปุ่ม
 *   ในหน้า target data ชวนให้เลือก .xlsx แล้วไปเด้ง error ที่ backend
 *   ข้อความบนปุ่มจึงสร้างจาก `accept` ตรงๆ ป้ายกับไฟล์ที่รับจริงจะหลุดจากกันไม่ได้
 */
function AdminFileUploadRow({ label, hint, accept, file, onFileChange, result, resetKey }) {
  const inputId = `file-input-${label}`;
  // แปลง ".xlsx,.csv" -> [".xlsx", ".csv"] ใช้ทั้งทำป้ายปุ่มและตรวจนามสกุลไฟล์ที่ผู้ใช้เลือก
  const allowedExtensions = accept
    .split(",")
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean);
  const acceptLabel = allowedExtensions.join(" / ");

  // ข้อความเตือนเมื่อผู้ใช้เลือกไฟล์นามสกุลอื่น — attribute accept ของ <input> เป็นแค่ตัวกรองใน
  // กล่องเลือกไฟล์ ผู้ใช้กด "All files" แล้วเลือกอะไรก็ได้ ต้องเช็คซ้ำฝั่ง JS ก่อนส่งขึ้น backend
  const [extensionError, setExtensionError] = useState("");

  // ล้างข้อความเตือนตอน import เสร็จ (resetKey เปลี่ยน) ให้แถวกลับเป็นสถานะว่างพร้อมกับ input
  useEffect(() => setExtensionError(""), [resetKey]);

  const handleInputChange = (event) => {
    const selected = event.target.files?.[0] || null;

    if (!selected) {
      setExtensionError("");
      onFileChange(null);
      return;
    }

    const fileName = selected.name.toLowerCase();
    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      setExtensionError(`ไฟล์นี้นามสกุลไม่ถูกต้อง รับเฉพาะ ${acceptLabel} เท่านั้น`);
      onFileChange(null);
      return;
    }

    setExtensionError("");
    onFileChange(selected);
  };

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
            {file ? "เปลี่ยนไฟล์" : `เลือกไฟล์ ${acceptLabel}`}
            <input
              // key ผูกกับ resetKey เพื่อ remount input หลัง import เสร็จ — ล้างค่าไฟล์ใน DOM
              // ให้เลือกไฟล์ชื่อเดิมซ้ำได้และ trigger onChange อีกครั้ง
              key={resetKey}
              id={inputId}
              type="file"
              accept={accept}
              hidden
              onChange={handleInputChange}
            />
          </MKButton>
          {file && (
            <MKTypography variant="caption" color="text" display="block" mt={0.5} noWrap>
              {file.name}
            </MKTypography>
          )}
          {extensionError && (
            <MKTypography variant="caption" color="error" display="block" mt={0.5}>
              {extensionError}
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
              {/* แจ้งเตือนแถวซ้ำในไฟล์ — ไม่ใช่ error (ระบบนำเข้าให้แล้วโดยใช้ข้อมูลแถวล่าสุด)
                  แต่เจ้าหน้าที่ควรรู้ว่าไฟล์มีแถวซ้ำ จึงโชว์รายละเอียดสองสามรายการแรกให้ไปแก้ไฟล์ได้ */}
              {result.data?.duplicateCount > 0 && (
                <MKBox mt={0.5}>
                  <MKTypography variant="caption" color="warning" fontWeight="bold" display="block">
                    พบแถวซ้ำในไฟล์ {result.data.duplicateCount} แถว — ระบบใช้ข้อมูลจากแถวล่าสุด
                  </MKTypography>
                  {(result.data.warnings || []).slice(0, WARNING_PREVIEW_COUNT).map((warning) => (
                    <MKTypography key={warning} variant="caption" color="text" display="block">
                      • {warning}
                    </MKTypography>
                  ))}
                  {(result.data.warnings || []).length > WARNING_PREVIEW_COUNT && (
                    <MKTypography variant="caption" color="text" display="block">
                      และอีก {result.data.warnings.length - WARNING_PREVIEW_COUNT} รายการ
                    </MKTypography>
                  )}
                </MKBox>
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
  // ค่า default เป็นของหน้า master data (รับทั้ง 2 นามสกุล) — หน้า target data ต้องส่ง ".csv" มาเอง
  accept: ".xlsx,.csv",
  file: null,
  result: null,
  resetKey: 0,
};

AdminFileUploadRow.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  // นามสกุลที่รับ คั่นด้วย comma เช่น ".csv" หรือ ".xlsx,.csv" — ใช้ทั้งทำป้ายปุ่มและตรวจไฟล์ที่เลือก
  accept: PropTypes.string,
  file: PropTypes.shape({ name: PropTypes.string }),
  onFileChange: PropTypes.func.isRequired,
  result: PropTypes.shape({
    success: PropTypes.bool,
    message: PropTypes.string,
    data: PropTypes.shape({
      errors: PropTypes.arrayOf(PropTypes.string),
      // แถวซ้ำในไฟล์ที่ถูกตัดออก (ใช้ข้อมูลแถวล่าสุด) — duplicateCount คือจำนวนจริงทั้งหมด
      // ส่วน warnings เป็นรายละเอียดที่ backend จำกัดจำนวนไว้กัน payload บวม
      warnings: PropTypes.arrayOf(PropTypes.string),
      duplicateCount: PropTypes.number,
    }),
  }),
  resetKey: PropTypes.number,
};

export default AdminFileUploadRow;
