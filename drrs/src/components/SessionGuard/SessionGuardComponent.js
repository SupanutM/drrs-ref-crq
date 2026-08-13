import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import LinearProgress from "@mui/material/LinearProgress";

import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";

import useSessionTimeout from "utils/useSessionTimeout";
import useTabLimit from "utils/useTabLimit";
import { getAppConfig } from "utils/appConfig";

/**
 * SessionGuard
 * ครอบ children เพื่อ:
 * 1. ตรวจสอบ idle timeout → แสดง warning dialog → redirect ไป /drrs/consent
 * 2. ตรวจสอบจำนวน tab → ถ้าเกิน MAX_CONNECTIONS → block ไม่ให้ใช้งาน
 *
 * @param {React.ReactNode} children
 */
function SessionGuard({ children }) {
  const navigate = useNavigate();
  const config = getAppConfig();

  // --- Timeout ---
  const { showWarning, countdown, forceReset, setOnTimeout } = useSessionTimeout(true);

  useEffect(() => {
    setOnTimeout(() => {
      navigate("/drrs/consent");
    });
  }, [setOnTimeout, navigate]);

  // --- Tab Limit ---
  const { isOverLimit } = useTabLimit(true);

  const progressValue = (countdown / config.sessionWarning) * 100;

  return (
    <>
      {children}

      {/* ===== Warning Dialog: Idle Timeout ===== */}
      <Dialog
        open={showWarning && !isOverLimit}
        onClose={() => {}} // ปิดไม่ได้โดยคลิก backdrop
        disableEscapeKeyDown
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ pb: 0, pt: 3, textAlign: "center" }}>
          <MKTypography variant="h1" sx={{ fontSize: "2.5rem", lineHeight: 1 }}>
            ⏱️
          </MKTypography>
          <MKTypography variant="h5" component="span" fontWeight="bold" mt={1} color="warning" display="block">
            Session ใกล้หมดอายุ
          </MKTypography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2, pb: 1, textAlign: "center" }}>
          <MKTypography variant="body2" color="text" mb={2}>
            ท่านไม่มีการใช้งานในระบบ ระบบจะออกจากหน้านี้ใน
          </MKTypography>

          <MKTypography
            variant="h2"
            fontWeight="bold"
            color={countdown <= 10 ? "error" : "warning"}
            sx={{ fontSize: "3rem", lineHeight: 1, mb: 2 }}
          >
            {countdown}
          </MKTypography>

          <MKTypography variant="caption" color="text" mb={1} display="block">
            วินาที
          </MKTypography>

          <LinearProgress
            variant="determinate"
            value={progressValue}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#f5e6e6",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                backgroundColor: countdown <= 10 ? "#f44336" : "#ff9800",
                transition: "background-color 0.5s",
              },
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1, flexDirection: "column", gap: 1 }}>
          <MKButton
            variant="gradient"
            color="warning"
            fullWidth
            onClick={forceReset}
            sx={{ py: 1.5, borderRadius: "10px", fontWeight: "bold" }}
          >
            ยังอยู่ในระบบ
          </MKButton>
          <MKButton
            variant="outlined"
            color="secondary"
            fullWidth
            onClick={() => navigate("/drrs/consent")}
            sx={{ py: 1.2, borderRadius: "10px" }}
          >
            ออกจากระบบ
          </MKButton>
        </DialogActions>
      </Dialog>

      {/* ===== Tab Limit Dialog ===== */}
      <Dialog
        open={isOverLimit}
        onClose={() => {}} // ปิดไม่ได้
        disableEscapeKeyDown
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: "16px",
          },
        }}
      >
        <DialogTitle sx={{ pb: 0, pt: 3, textAlign: "center" }}>
          <MKTypography variant="h1" sx={{ fontSize: "2.5rem", lineHeight: 1 }}>
            🚫
          </MKTypography>
          <MKTypography variant="h5" component="span" fontWeight="bold" mt={1} color="error" display="block">
            มีผู้ใช้งานเข้าใช้มากเกินไป
          </MKTypography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2, pb: 1, textAlign: "center" }}>
          <MKTypography variant="body2" color="text" mt={1}>
            กรุณาลองใหม่ในภายหลัง
          </MKTypography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
          <MKButton
            variant="gradient"
            color="error"
            fullWidth
            onClick={() => navigate("/drrs/consent")}
            sx={{ py: 1.5, borderRadius: "10px", fontWeight: "bold" }}
          >
            ตกลง
          </MKButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

SessionGuard.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SessionGuard;
