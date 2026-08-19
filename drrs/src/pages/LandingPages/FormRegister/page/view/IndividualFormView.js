import PropTypes from "prop-types";

// @mui material components
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";

// Material Kit 2 React components
import { DatePickerCustoms } from "components/DatePickerCustoms";
import MKBox from "components/MKBox";
import MKButton from "components/MKButton";
import MKTypography from "components/MKTypography";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Snackbar from "@mui/material/Snackbar";
import MKInput from "components/MKInput";

import LoadingComponent from "components/Loading/LoadingComponent";

function IndividualFormView(props) {
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
                    <Grid container justifyContent="center" py={2} spacing={1}>

                        {/* 1. เลขบัตรประชาชน */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> เลขบัตรประชาชน </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุเลขบัตรประชาชน 13 หลัก"
                                onChange={handlers.handleChangeCitizenId} onBlur={handlers.handleBlurCitizenId} value={state.citizenId || ""} error={state.validCitizenId} inputProps={{ maxLength: 13 }} autoComplete="off" fullWidth required
                            />
                            {state.validCitizenId ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error">
                                    กรุณาระบุเลขบัตรประชาชนให้ถูกต้อง หรือครบถ้วน
                                </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 2. เลขหลังบัตรประชาชน */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> เลขหลังบัตรประชาชน </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุเลขหลังบัตรประชาชน"
                                onChange={handlers.handleChangeLaserCardId} onBlur={handlers.handleBlurLaserCardId} value={state.laserCardId || ""} error={state.validLaserCardId} inputProps={{ maxLength: 12 }} autoComplete="off" fullWidth required />
                            {state.validLaserCardId ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error">
                                    กรุณาระบุเลขหลังบัตรประชาชนให้ถูกต้อง (2 ตัวอักษรภาษาอังกฤษ ตามด้วยตัวเลข 10 ตัว)
                                </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 3. ชื่อ */}
                        <Grid item xs={12} sm={12} md={3} lg={3}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> ชื่อ </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุชื่อ"
                                onChange={handlers.handleChangeName} onBlur={handlers.handleBlurName} value={state.name || ""} error={state.validName} autoComplete="off" fullWidth required />
                            {state.validName ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error">
                                    กรุณาระบุชื่อให้ถูกต้อง
                                </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 4. นามสกุล */}
                        <Grid item xs={12} sm={12} md={3} lg={3}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> นามสกุล </MKTypography>
                            <MKInput type="text" color="primary" label="ระบุนามสกุล"
                                onChange={handlers.handleChangeSurname} onBlur={handlers.handleBlurSurname} value={state.surname || ""} error={state.validSurname} autoComplete="off" fullWidth required />
                            {state.validSurname ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error">
                                    กรุณาระบุนามสกุลให้ถูกต้อง
                                </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 5. ประเภทข้อมูลวัน/เดือน/ปีเกิด */}
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <FormControl component="fieldset" fullWidth>
                                <MKTypography variant="body2" color="dark" mb={0.5}>
                                    วัน/เดือน/ปี (พ.ศ.) เกิด
                                </MKTypography>
                                <RadioGroup
                                    value={state.birthDateType || ""}
                                    onChange={(e) => handlers.handleSetBirthDateType(e.target.value)}
                                    sx={{
                                        display: "flex",
                                        flexDirection: { xs: "column", sm: "column", md: "column", lg: "row" },
                                        gap: { xs: 1, sm: 1, md: 1, lg: 2 }
                                    }}
                                >
                                    <FormControlLabel
                                        value="1"
                                        control={<Radio sx={{ p: 0.5, mt: 0.2, mr: 0.5 }} />}
                                        label={<MKTypography variant="body2" color="dark">มีข้อมูลครบถ้วนทั้ง วัน/เดือน/ปี</MKTypography>}
                                        sx={{
                                            display: "flex",
                                            flexDirection: "row",
                                            flexWrap: "nowrap",
                                            alignItems: "flex-start",
                                            mr: { xs: 0, lg: 2 },
                                            ml: 0,
                                            width: { xs: "100%", sm: "100%", md: "100%", lg: "auto" },
                                            "& .MuiFormControlLabel-label": {
                                                flex: 1,
                                                minWidth: 0,
                                                whiteSpace: "normal"
                                            }
                                        }}
                                    />
                                    <FormControlLabel
                                        value="2"
                                        control={<Radio sx={{ p: 0.5, mt: 0.2, mr: 0.5 }} />}
                                        label={<MKTypography variant="body2" color="dark">มีข้อมูลไม่ครบถ้วน (ระบุเฉพาะปี หรือ เดือน/ปี)</MKTypography>}
                                        sx={{
                                            display: "flex",
                                            flexDirection: "row",
                                            flexWrap: "nowrap",
                                            alignItems: "flex-start",
                                            mr: 0,
                                            ml: 0,
                                            width: { xs: "100%", sm: "100%", md: "100%", lg: "auto" },
                                            "& .MuiFormControlLabel-label": {
                                                flex: 1,
                                                minWidth: 0,
                                                whiteSpace: "normal"
                                            }
                                        }}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </Grid>

                        {/* 6. วัน/เดือน/ปีเกิด */}
                        {state.birthDateType === "1" ? (
                            <Grid item xs={12} sm={12} md={12} lg={12}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={12} md={4} lg={4}>
                                        <MKTypography variant="body2" fontWeight="regular" color="dark"> วัน/เดือน/ปี (พ.ศ.) เกิด </MKTypography>
                                        <DatePickerCustoms
                                            showTodayButton={false}
                                            value={state.birthDateFull}
                                            onChange={(christDate, buddhistDate) => handlers.handleSetDateOfBirth(buddhistDate, "full")}
                                            placeholder={"ระบุ วัน/เดือน/ปี (พ.ศ.) เกิด"} dateFormat={"yyyy-MM-dd"} displayFormat={"DD MMMM YYYY"}
                                            clearable={true} readOnly={false} yearBoundary={99} autoComplete="off" error={state.validBirthtDay}
                                        />
                                        {state.validBirthtDay ? (
                                            <MKTypography variant="caption" fontWeight="medium" color="error">
                                                กรุณาระบุ วัน/เดือน/ปี (พ.ศ.) เกิด ให้ถูกต้อง
                                            </MKTypography>
                                        ) : null}
                                    </Grid>
                                </Grid>
                            </Grid>
                        ) : state.birthDateType === "2" ? (
                            <Grid item xs={12} sm={12} md={12} lg={12}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={12} md={4} lg={4}>
                                        <MKTypography variant="body2" fontWeight="regular" color="dark"> เลือกเฉพาะ เดือน/ปี (พ.ศ.) เกิด </MKTypography>
                                        <DatePickerCustoms
                                            showTodayButton={false}
                                            showMonthYearPicker={true}
                                            value={state.birthDateMonthYear}
                                            onChange={(christDate, buddhistDate) => handlers.handleSetDateOfBirth(buddhistDate, "monthYear")}
                                            placeholder={"ระบุ เดือน/ปี (พ.ศ.) เกิด"} displayFormat={"MMMM YYYY"}
                                            clearable={true} readOnly={false} yearBoundary={99} autoComplete="off" error={state.validBirthtDay}
                                        />
                                        {state.validBirthtDay ? (
                                            <MKTypography variant="caption" fontWeight="medium" color="error">
                                                กรุณาระบุ เดือน/ปี (พ.ศ.) เกิด ให้ถูกต้อง
                                            </MKTypography>
                                        ) : null}
                                    </Grid>
                                    <Grid item xs={12} sm={12} md={4} lg={4}>
                                        <MKTypography variant="body2" fontWeight="regular" color="dark"> หรือเลือกเฉพาะ ปี (พ.ศ.) เกิด </MKTypography>
                                        <DatePickerCustoms
                                            showTodayButton={false}
                                            showYearPicker={true}
                                            value={state.birthDateYear}
                                            onChange={(christDate, buddhistDate) => handlers.handleSetDateOfBirth(buddhistDate, "year")}
                                            placeholder={"ระบุ ปี (พ.ศ.) เกิด"} displayFormat={"YYYY"}
                                            clearable={true} readOnly={false} yearBoundary={99} autoComplete="off" error={state.validBirthtDay}
                                        />
                                        {state.validBirthtDay ? (
                                            <MKTypography variant="caption" fontWeight="medium" color="error">
                                                กรุณาระบุ ปี (พ.ศ.) เกิด ให้ถูกต้อง
                                            </MKTypography>
                                        ) : null}
                                    </Grid>
                                </Grid>
                            </Grid>
                        ) : null}


                        {/* 6. เบอร์โทรติดต่อ */}
                        <Grid item xs={12} sm={12} md={4} lg={4}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> เบอร์โทรติดต่อ </MKTypography>
                            <MKInput type="tel" color="primary" label="ระบุเบอร์โทรติดต่อ"
                                onChange={handlers.handleChangeTelNo} onBlur={handlers.handleBlurTelNo} value={state.telNo || ""} error={state.validTelNo} inputProps={{ maxLength: 10 }} autoComplete="off" fullWidth required />
                            {state.validTelNo ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุเบอร์โทรติดต่อให้ถูกต้อง หรือครบถ้วน (10 หลัก) </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 10. อีเมล */}
                        <Grid item xs={12} sm={12} md={4} lg={4}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> อีเมล </MKTypography>
                            <MKInput type="email" color="primary" label="ระบุอีเมล (สำหรับการจัดส่งสำเนาสัญญาอิเล็กทรอนิกส์)"
                                onChange={handlers.handleChangeEmail} onBlur={handlers.handleBlurEmail} value={state.email || ""} error={state.validEmail} autoComplete="off" fullWidth />
                            {state.validEmail ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุอีเมลให้ถูกต้อง (เช่น example@domain.com) </MKTypography>
                            ) : null}
                        </Grid>

                        {/* 7. รหัสตัวเลข 4 ตัวจากธนาคาร */}
                        <Grid item xs={12} sm={12} md={4} lg={4}>
                            <MKTypography variant="body2" fontWeight="regular" color="dark"> รหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร </MKTypography>
                            <MKInput type="tel" color="primary" label="ระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร"
                                onChange={handlers.handleChangeDigitNo} onBlur={handlers.handleBlurDigitNo} value={state.digitNo || ""} error={state.validDigitNo} inputProps={{ maxLength: 4, inputMode: "numeric", pattern: "[0-9]*" }} autoComplete="off" fullWidth required />
                            {state.validDigitNo ? (
                                <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร ให้ถูกต้อง </MKTypography>
                            ) : null}
                        </Grid>
                    </Grid>

                    {/* ปุ่มยืนยันการลงทะเบียน */}
                    <Grid container justifyContent="center" py={2}>
                        <MKButton
                            variant="contained" color="primary"
                            onClick={handlers.handleConfirmRegister}
                            disabled={
                                state.validCitizenId || state.validLaserCardId || state.validName || state.validSurname ||
                                state.validBirthtDay || state.validTelNo || state.validDigitNo ||
                                state.validTotalIncome || state.validTotalCost || state.isLoading
                            }
                        >
                            ยืนยันการลงทะเบียน
                        </MKButton>
                    </Grid>

                    {/* ส่วนแสดงสถานะ Loading */}
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

                <LoadingComponent isOpen={loadingCircular || false} message="กำลังตรวจสอบสิทธิ์ กรุณารอสักครู่..." />

            </Container>
        </MKBox>
    );
}

IndividualFormView.defaultProps = { consentFlag: false };
IndividualFormView.propTypes = {
    consentFlag: PropTypes.bool.isRequired,
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default IndividualFormView; 