import PropTypes from "prop-types";

// import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";

import ModalComponent from "components/Dialog/DialogComponent";
import LoadingComponent from "components/Loading/LoadingComponent";
import MKBox from "components/MKBox";
// import MKButton from "components/MKButton";
import MKInput from "components/MKInput";
import MKTypography from "components/MKTypography";

function HaircutPlanView(props) {
    const { state, handlers } = props;
    const { routerState, isLoading, isModalOpen, paymentMethod, paymentChannels, isSuccessModalOpen, successMessage, isWarnModalOpen, warnMessage } = state;
    const { handleCloseModal, handleAccept, handleInputChange, handleSuccessConfirm, handleCloseWarnModal } = handlers;

    const selectedPlan = routerState?.selectedPlan?.planNo;
    const planName = routerState?.selectedPlan?.planName;
    const loadingCircular = isLoading && isLoading !== undefined;

    return (
        <MKBox textAlign="center" py={5} bgColor="grey-100" borderRadius="xl">
            <MKTypography variant="h4" color="info" mb={2}>
                Haircut Plan ✂️
            </MKTypography>

            <MKTypography variant="body1" color="text">
                รหัสแผนที่คุณเลือกคือ:
            </MKTypography>

            <MKTypography variant="h3" color="dark" mt={1} mb={4}>
                แผนที่ {selectedPlan} : {planName}
            </MKTypography>

            {/* 🌟 ปุ่มกดยอมรับ */}
            {/* <Grid container justifyContent="center" mt={4}>
                <MKButton variant="gradient" color="info" size="large" onClick={handleAccept} disabled={loadingCircular}>
                    ยอมรับข้อเสนอ (ปิดยอด)
                </MKButton>
            </Grid> */}

            {/* 1. Modal ระบุข้อมูลการชำระเงิน */}
            <ModalComponent
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onConfirm={handleAccept}
                title="ระบุข้อมูลการชำระเงิน"
                isConfirmDisabled={!paymentMethod}
                confirmColor="info"
                content={
                    <MKBox display="flex" flexDirection="column" gap={3} mt={1}>
                        <MKTypography variant="body2" color="text" textAlign="left">
                            คุณกำลังเลือกดำเนินการสำหรับ <b>{routerState?.selectedPlan?.title || ""}</b> กรุณาระบุช่องทางที่คุณสะดวกชำระเงิน:
                        </MKTypography>

                        <MKInput
                            select
                            label="ช่องทางการชำระเงิน"
                            value={paymentMethod}
                            onChange={handleInputChange}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            SelectProps={{ displayEmpty: true }}
                            sx={{
                                "& .MuiInputBase-root": { minHeight: "48px" },
                                "& .MuiSelect-select": { fontSize: "1rem", paddingTop: "12px", paddingBottom: "12px" }
                            }}
                        >
                            {
                                paymentChannels.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))
                            }
                        </MKInput>
                    </MKBox>
                }
            />

            {/* 2. Modal ทำรายการสำเร็จ */}
            <ModalComponent
                isOpen={isSuccessModalOpen}
                onClose={handleSuccessConfirm}
                onConfirm={handleSuccessConfirm}
                variant="success"
                title={successMessage || "บันทึกข้อมูลแผนการปรับปรุงโครงสร้างหนี้สำเร็จ!"}
                content="ระบบกำลังพาท่านไปยังหน้าขั้นตอนถัดไป..."
                confirmText="ดำเนินการต่อ"
            />

            {/* 3. Modal แจ้งเตือนระบบขัดข้อง/สร้างซ้ำ */}
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
        </MKBox >
    );
}

HaircutPlanView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default HaircutPlanView;