import PropTypes from "prop-types";

import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";

import MKBox from "components/MKBox";
import MKButton from "components/MKButton";
import MKTypography from "components/MKTypography";
// import MKAlert from "components/MKAlert";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import LoadingComponent from "components/Loading/LoadingComponent";
import MKInput from "components/MKInput";


function JuristicFormView(props) {
    const { state, handlers } = props;
    const { isLoading } = state;

    const loadingCircular = isLoading && isLoading !== undefined;

    return (
        <MKBox component="section" py={{ xs: 2, sm: 0 }}>
            <Container>
                <Snackbar open={state.isAlert} autoHideDuration={5000} onClose={handlers.handleCloseAlert} anchorOrigin={{ vertical: "top", horizontal: "right" }} >
                    <Alert
                        onClose={handlers.handleCloseAlert}
                        severity={state.alertType || "success"}
                        variant="filled"
                        sx={{
                            width: "100%",
                            color: "#fff",
                            position: "relative", // 2. สำคัญ: ต้องใส่ relative เพื่อให้เส้นวิ่งเกาะอยู่ด้านล่างของ Alert นี้
                            overflow: "hidden"    // กันไม่ให้เส้นวิ่งล้นขอบมุมโค้งของ Alert
                        }}
                    >
                        {state.alertMsg}

                        {
                            state.isAlert && (
                                <MKBox
                                    sx={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        height: "4px", // ความหนาของเส้นวิ่ง
                                        backgroundColor: "rgba(255, 255, 255, 0.7)", // สีของเส้นวิ่ง (สีขาวโปร่งแสง)
                                        animation: "progress-bar 6s linear forwards", // 6s คือเวลา 6 วินาที ต้องตั้งให้ตรงกับ autoHideDuration ด้านบน
                                        "@keyframes progress-bar": {
                                            "0%": { width: "100%" }, // เริ่มต้นที่กว้าง 100%
                                            "100%": { width: "0%" }, // วิ่งไปจนเหลือ 0%
                                        },
                                    }}
                                />
                            )
                        }
                    </Alert>
                </Snackbar>

                <Grid container item xs={12} justifyContent="center">
                    {/* <MKTypography variant="h5" color="primary" justifyContent="center">
                        ระบุข้อมูลสำหรับการลงทะเบียน (นิติบุคคล)
                    </MKTypography> */}

                    <Grid container justifyContent="center" py={2} spacing={1}>

                        {/* 1. เลขนิติบุคคล */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> เลขนิติบุคคล </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุเลขนิติบุคคล 13 หลัก"
                                onChange={handlers.handleChangeCitizenId} value={state.citizenId || ""} error={state.validCitizenId} autoComplete="off" fullWidth required disabled
                            />
                            {state.validCitizenId ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุเลขนิติบุคคลให้ถูกต้อง หรือครบถ้วน </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 2. ชื่อบริษัท/นิติบุคคล (ขยายเป็นเต็มบรรทัดเพราะไม่มีนามสกุล) */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> ชื่อนิติบุคคล </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุชื่อนิติบุคคล"
                                onChange={handlers.handleChangeName} value={state.name || ""} error={state.validName} autoComplete="off" fullWidth required disabled />
                            {state.validName ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุชื่อนิติบุคคลให้ถูกต้อง </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 3. เบอร์โทรติดต่อ */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> เบอร์โทรติดต่อ </MKTypography>
                            <MKInput type="tel" color="primary" label="ระบุเบอร์โทรติดต่อ"
                                onChange={handlers.handleChangeTelNo} value={state.telNo || ""} error={state.validTelNo} autoComplete="off" fullWidth required disabled />
                            {state.validTelNo ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุเบอร์โทรติดต่อให้ถูกต้อง หรือครบถ้วน (10 หลัก) </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 4. รหัสตัวเลข 4 ตัวจากธนาคาร */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> รหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร"
                                onChange={handlers.handleChangeDigitNo} value={state.digitNo || ""} error={state.validDigitNo} autoComplete="off" fullWidth required disabled />
                            {state.validDigitNo ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร ให้ถูกต้อง </MKTypography>
                            ) : null}
                        </Grid>
                    </Grid>

                    <Grid container justifyContent="center" py={2}>
                        <MKButton
                            variant="contained" color="primary"
                            onClick={handlers.handleConfirmRegister}
                            // disabled={
                            //     state.validCitizenId || state.validName || state.validTelNo ||
                            //     state.validDigitNo || state.validTotalIncome || state.validTotalCost || state.isLoading
                            // }
                            disabled
                        >
                            ยืนยันการลงทะเบียน
                        </MKButton>
                    </Grid>

                    {state.isLoading ? (
                        <Grid container justifyContent="center">
                            <Grid item xs={12} sm={12} md={6} lg={6}>
                                <Stack sx={{ width: "50%" }}>
                                    <LinearProgress color="primary" />
                                </Stack>
                            </Grid>
                        </Grid>
                    ) : null}

                </Grid>
                <LoadingComponent isOpen={loadingCircular} message="กำลังตรวจสอบสิทธิ์ กรุณารอสักครู่..." />
            </Container>
        </MKBox>
    );
}

JuristicFormView.defaultProps = { consentFlag: false };
JuristicFormView.propTypes = {
    consentFlag: PropTypes.bool.isRequired,
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default JuristicFormView;