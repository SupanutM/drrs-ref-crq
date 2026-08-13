import PropTypes from "prop-types";
// import Grid from "@mui/material/Grid";

import ModalComponent from "components/Dialog/DialogComponent";
import LoadingComponent from "components/Loading/LoadingComponent";
import MKBox from "components/MKBox";
// import MKButton from "components/MKButton";
import MKTypography from "components/MKTypography";

function InstallmentPlanView(props) {
    const { state, handlers } = props;
    const { routerState, isLoading, isSuccessModalOpen, successMessage, isWarnModalOpen, warnMessage } = state;
    const {/*  handleAccept, */ handleSuccessConfirm, handleCloseWarnModal } = handlers;

    const selectedPlan = routerState?.selectedPlan?.planNo;
    const planName = routerState?.selectedPlan?.planName;
    const loadingCircular = isLoading && isLoading !== undefined;

    return (
        <MKBox textAlign="center" py={5} bgColor="grey-100" borderRadius="xl">
            <MKTypography variant="h4" color="success" mb={2}>
                Installment Plan 🗓️
            </MKTypography>

            <MKTypography variant="body1" color="text">
                รหัสแผนที่คุณเลือกคือ:
            </MKTypography>

            <MKTypography variant="h3" color="dark" mt={1} mb={4}>
                แผนที่ {selectedPlan} : {planName}
            </MKTypography>

            {/* 🌟 ปุ่มกดยอมรับ */}
            {/* <Grid container justifyContent="center" mt={4}>
                <MKButton variant="gradient" color="success" size="large" onClick={handleAccept} disabled={loadingCircular}>
                    ยอมรับข้อเสนอ (ผ่อนชำระ)
                </MKButton>
            </Grid> */}

            {/* 1. Modal ทำรายการสำเร็จ */}
            <ModalComponent
                isOpen={isSuccessModalOpen}
                onClose={handleSuccessConfirm}
                onConfirm={handleSuccessConfirm}
                variant="success"
                title={successMessage || "บันทึกข้อมูลแผนการปรับปรุงโครงสร้างหนี้สำเร็จ!"}
                content="ระบบกำลังพาท่านไปยังหน้าขั้นตอนถัดไป..."
                confirmText="ดำเนินการต่อ"
            />

            {/* 2. Modal แจ้งเตือนระบบขัดข้อง/สร้างซ้ำ */}
            <ModalComponent
                isOpen={isWarnModalOpen}
                onClose={handleCloseWarnModal}
                onConfirm={handleCloseWarnModal}
                variant="warning" // 🌟 บอกให้แสดงไอคอน ❌ และปุ่มสีแดง (ถ้าอยากได้ไอคอน ⚠️ ให้ใช้ variant="warning" แทนครับ)
                title="เกิดข้อผิดพลาดในการบันทึกข้อมูล"
                content={warnMessage || "ไม่สามารถทำรายการได้"}
                confirmText="ตกลง"
            />

            {/* 🌟 Backdrop โหลด */}
            <LoadingComponent isOpen={loadingCircular || false} />
        </MKBox>
    );
}

InstallmentPlanView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default InstallmentPlanView;