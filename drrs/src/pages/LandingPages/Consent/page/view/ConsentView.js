import React from "react";
import PropTypes from "prop-types";

import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";

import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

import MKBox from "components/MKBox";
import MKButton from "components/MKButton";
import MKTypography from "components/MKTypography";
import MKAlert from "components/MKAlert";

import closeImage from "assets/images/Close3.jpg";

function ConsentView(props) {
    const { state, handlers, isClose } = props;
    const { isAlert, checked } = state;
    const { handleChange, handleAcceptConsent } = handlers;

    return (
        <MKBox component="section" py={{ xs: 0.8, sm: 10 }}>
            <Container>
                {isAlert ? (
                    <>
                        <MKAlert color="warning" dismissible>
                            กรุณายอมรับข้อตกลงในการลงทะเบียน
                        </MKAlert>
                        <br />
                    </>
                ) : null}

                {isClose === "OFF" ? (
                    <Grid container justifyContent="center" py={2}>
                        <Grid item xs={12} md={12} mx={{ xs: "auto", sm: 6, md: 1 }}>
                            <MKBox
                                component="img"
                                src={closeImage} // เรียกใช้รูปภาพตรงนี้
                                alt={"Info"}
                                width="100%"
                                borderRadius="md"
                                shadow="lg"
                                textAlign="center"
                            />
                        </Grid>
                    </Grid>
                ) : (
                    <Grid container item xs={12} justifyContent="center" mx="auto">
                        <MKTypography variant="h5" color="primary" justifyContent="center">
                            ข้อตกลงในการลงทะเบียน
                        </MKTypography>
                        <Grid container justifyContent="center" py={2}>
                            <Grid item xs={12} md={12} mx={{ xs: "auto", sm: 6, md: 1 }}>
                                <MKTypography variant="body2" fontWeight="regular" color="dark">
                                    ข้าพเจ้าขอรับรองว่าข้อมูล รายละเอียด หรือข้อเท็จจริง
                                    และหลักฐานใดๆที่ข้าพเจ้าได้ให้ไว้ในการลงทะเบียน
                                    หรือที่ข้าพเจ้ามอบให้แก่ธนาคารทั้งหมด เพื่อการเข้าร่วมมาตรการ นั้น
                                    ถูกต้องและเป็นจริงทุกประการ ข้าพเจ้าตกลงให้ธนาคารซึ่งเป็นผู้ให้บริการสินเชื่อ
                                    จัดเก็บและประมวลผลข้อมูลที่ข้าพเจ้าได้ให้ไว้กับธนาคาร
                                    เพื่อใช้ในลงทะเบียนขอปรับปรุงโครงสร้างหนี้และเพื่อใช้ในธุรกิจธนาคาร
                                    ข้าพเจ้ารับทราบว่าการนำเข้าสู่ระบบคอมพิวเตอร์ซึ่งข้อมูลอันเป็นเท็จเป็นการกระทำความผิดตามกฎหมาย
                                    หากข้อมูลดังกล่าวไม่ถูกต้องตรงตามความเป็นจริง
                                    ข้าพเจ้าตกลงยินยอมให้ธนาคารยกเลิกเงื่อนไขการเข้าร่วมมาตรการ
                                </MKTypography>
                            </Grid>
                            <br />
                            <Grid item xs={12} md={12} mx={{ xs: "auto", sm: 6, md: 1 }}>
                                <MKTypography variant="body2" fontWeight="regular" color="dark">
                                    ข้าพเจ้ายินยอมให้ธนาคารตรวจสอบข้อมูลและรายละเอียดที่ให้ไว้แก่ธนาคารได้ตามที่ธนาคารเห็นสมควร
                                    หากข้าพเจ้าไม่มีคุณสมบัติ หรือผิดหลักเกณฑ์ เงื่อนไขของธนาคาร
                                    หรือผิดคำรับรองที่ให้ไว้ ข้าพเจ้ายินยอมให้ถือเป็นเหตุผิดสัญญา
                                </MKTypography>
                            </Grid>
                        </Grid>

                        <Grid container justifyContent="center" py={2}>
                            <FormControlLabel
                                control={<Checkbox color="primary" checked={checked} onChange={handleChange} />}
                                label="ข้าพเจ้ายอมรับข้อตกลงในการลงทะเบียน"
                            />
                        </Grid>

                        <Grid container justifyContent="center" py={2}>
                            <MKButton variant="contained" color="primary" onClick={handleAcceptConsent}>
                                ยอมรับ
                            </MKButton>
                        </Grid>
                    </Grid>
                )}
            </Container>
        </MKBox>
    );
}

ConsentView.defaultProps = {
    consentFlag: false,
    isClose: ""
};

ConsentView.propTypes = {
    consentFlag: PropTypes.bool.isRequired,
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
    isClose: PropTypes.string,
};

export default ConsentView;