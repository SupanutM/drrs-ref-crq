import PropTypes from "prop-types";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Snackbar from "@mui/material/Snackbar";
import LoadingComponent from "components/Loading/LoadingComponent";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

// ... import ต่างๆ เหมือนเดิม ...

function LoanPlanView(props) {
    const { state, handlers } = props;
    const { loanPlans, isLoading, isAlert, alertMsg, alertType } = state;
    const { handleSelectPlan, handleCloseAlert } = handlers;

    // 🌟 1. ปรับให้คลีนขึ้น
    const loadingCircular = Boolean(isLoading);

    return (
        <MKBox component="section" py={{ xs: 2, sm: 4 }}>
            <Container>
                {/* เส้นนับถอยหลัง (progress-bar) ใต้ข้อความแจ้งเตือน — ให้ตรงกับ pattern เดียวกัน
                    ทุกหน้าที่แสดง error (form-register, income-modal) */}
                <Snackbar open={isAlert} autoHideDuration={5000} onClose={handleCloseAlert} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                    <Alert
                        onClose={handleCloseAlert}
                        severity={alertType || "success"}
                        variant="filled"
                        sx={{
                            width: "100%",
                            color: "#fff",
                            position: "relative",
                            overflow: "hidden"
                        }}
                    >
                        {alertMsg}
                        {
                            isAlert && (
                                <MKBox
                                    sx={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        height: "4px",
                                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                                        animation: "progress-bar 5s linear forwards",
                                        "@keyframes progress-bar": {
                                            "0%": { width: "100%" },
                                            "100%": { width: "0%" },
                                        },
                                    }}
                                />
                            )
                        }
                    </Alert>
                </Snackbar>

                <Grid container spacing={3} justifyContent="center">
                    {loanPlans?.map((plan) => {
                        return (
                            <Grid item xs={12} sm={6} md={4} key={plan.id}>
                                <Card
                                    sx={{
                                        p: 3,
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        textAlign: "center",
                                        cursor: loadingCircular ? "wait" : "pointer",
                                        transition: "all 0.3s ease",
                                        border: "2px solid transparent",
                                        "&:hover": {
                                            transform: loadingCircular ? "none" : "translateY(-5px)",
                                            boxShadow: ({ boxShadows: { xl } }) => xl,
                                            borderColor: loadingCircular ? "transparent" : "#eb3a75",
                                        },
                                    }}
                                    onClick={() => !loadingCircular && handleSelectPlan(plan)}
                                >
                                    <MKBox
                                        width="4rem"
                                        height="4rem"
                                        variant="gradient"
                                        bgColor="info"
                                        color="white"
                                        shadow="md"
                                        borderRadius="xl"
                                        display="flex"
                                        justifyContent="center"
                                        alignItems="center"
                                        mb={2}
                                    >
                                        <Icon fontSize="medium">{plan.icon}</Icon>
                                    </MKBox>

                                    <MKTypography variant="h5" color="dark" mb={1}>
                                        {plan.planName}
                                    </MKTypography>

                                    <MKTypography variant="body2" color="text" sx={{ whiteSpace: "pre-line" }}>
                                        {plan.planDesc}
                                    </MKTypography>
                                </Card>
                            </Grid>
                        );
                    })}

                </Grid>
            </Container>
            <LoadingComponent isOpen={loadingCircular || false} message="กำลังตรวจสอบสิทธิ์ กรุณารอสักครู่..." />
        </MKBox>
    );
}

LoanPlanView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default LoanPlanView;