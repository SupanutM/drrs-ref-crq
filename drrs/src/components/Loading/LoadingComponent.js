import React from "react";
import PropTypes from "prop-types";

import Portal from "@mui/material/Portal";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";

import MKTypography from "components/MKTypography"; 

function LoadingComponent(props) {
    const { isOpen, text, message } = props;

    // ทุกจุดที่เรียกใช้ส่ง prop ชื่อ "message" มา จึงรับทั้งสองชื่อ
    // (message มาก่อน, text เก็บไว้เพื่อความเข้ากันได้ย้อนหลัง)
    const displayText = message || text;

    return (
        <Portal>
            <Backdrop
                sx={{
                    color: "#fff",
                    zIndex: (theme) => Math.max(theme.zIndex.drawer, theme.zIndex.modal) + 999,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2
                }}
                open={isOpen}
            >
                <CircularProgress color="inherit" size={50} />
                <MKTypography variant="h5" color="white" textAlign="center">
                    {displayText}
                </MKTypography>
            </Backdrop>
        </Portal>
    );
}

// 🌟 ตั้งค่าข้อความเริ่มต้น (ถ้าตอนเรียกใช้ไม่ได้ส่งคำอะไรมา จะใช้คำนี้แทน)
LoadingComponent.defaultProps = {
    text: "กำลังบันทึกข้อมูล กรุณารอสักครู่...",
    message: undefined,
};

// ลงทะเบียน Props
LoadingComponent.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    text: PropTypes.string,
    message: PropTypes.string,
};

export default LoadingComponent;