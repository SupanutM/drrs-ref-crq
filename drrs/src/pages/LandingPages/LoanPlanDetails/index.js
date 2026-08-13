import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// @mui material components
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import DefaultNavbar from "examples/Navbars/DefaultNavbar";

// ==========================================
// นำเข้า Controller ของแต่ละ Widget
// ==========================================
import HaircutPlanController from "./page/controller/HaircutPlanController";
import InstallmentPlanController from "./page/controller/InstallmentPlanController";

// Routes
import routes from "routes";

function LoanPlanDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    const routerState = location.state;

    // State สำหรับเก็บ handleAccept ที่ได้จาก Controller
    const [acceptInfo, setAcceptInfo] = useState({ handleAccept: null, isLoading: false });

    const handleAcceptReady = useCallback((info) => {
        setAcceptInfo(info);
    }, []);

    // ตรวจสอบว่ามีข้อมูล selectedPlan ส่งมาด้วยหรือไม่
    useEffect(() => {
        if (!routerState || !routerState.selectedPlan) {
            navigate("/ndrs-gsb-register/loan-plan", { replace: true });
        }
    }, [navigate, routerState]);

    if (!routerState || !routerState.selectedPlan) {
        return null;
    }

    const { selectedPlan } = routerState;
    const isHaircut = selectedPlan.planNo === "01";

    return (
        <MKBox sx={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", backgroundColor: "#f8f9fa" }}>

            <DefaultNavbar
                routes={routes}
                action={{
                    type: "external",
                    route: "https://ln15.gsb.or.th/ndrs",
                    label: "GSB NDRS Website",
                    color: "default",
                }}
                backRoute
                transparent
                light
            />

            {/* แบนเนอร์ด้านบน (ปรับลดความสูงลงเหลือ 28vh เพื่อให้มีพื้นที่แสดงเนื้อหาใน Card มากขึ้น) */}
            <MKBox
                sx={{
                    minHeight: { xs: "180px", md: "20vh" },
                    flexShrink: 0,
                    width: "100%",
                    background: "linear-gradient(135deg, #eb3a75 0%, #c81b53 100%)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pt: { xs: "50px", md: "56px" },
                    pb: { xs: 4, md: 5 },
                }}
            >
                <Container>
                    <Grid container item xs={12} lg={10} justifyContent="center" alignItems="center" flexDirection="column" sx={{ mx: "auto", textAlign: "center" }}>
                        <MKTypography
                            variant="h2"
                            color="white"
                            fontWeight="bold"
                            sx={({ breakpoints, typography: { size } }) => ({
                                textShadow: "0 2px 10px rgba(0,0,0,0.15)",
                                fontSize: size["2xl"],
                                [breakpoints.down("md")]: { fontSize: size["xl"] },
                            })}
                        >
                            รายละเอียดแผนการชำระหนี้
                        </MKTypography>
                        <MKTypography variant="button" color="white" opacity={0.9} fontWeight="regular" mt={0.5}>
                            {selectedPlan.planName}
                        </MKTypography>
                    </Grid>
                </Container>
            </MKBox>

            {/* 🌟 กล่อง Card หลัก (รวม Content และ Footer ไว้ในใบเดียวกัน ไร้รอยต่อ) 🌟 */}
            <Card
                sx={({ borders: { borderRadius }, boxShadows: { xxl } }) => ({
                    mx: { xs: 2, lg: 4 },
                    mt: -7, /* ดึงขึ้นไปทับแบนเนอร์ด้านบนให้ดูมีมิติ */
                    mb: { xs: 2, lg: 3 },
                    borderRadius: borderRadius.xl,
                    boxShadow: xxl,
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden", /* ปิด overflow โค้งมนเพื่อให้ Scrollbar อยู่เฉพาะโซนกลาง */
                    backgroundColor: "#ffffff",
                })}
            >
                {/* --- โซนที่ 1: พื้นที่เนื้อหาที่สามารถเลื่อน Scroll ได้ --- */}
                <MKBox
                    sx={{
                        flexGrow: 1,
                        overflowY: "auto",
                        px: { xs: 2.5, md: 5, lg: 6 },
                        py: 4,
                    }}
                >
                    <Container maxWidth={false} sx={{ minHeight: "380px" }}>
                        {/* Controller วิดเจ็ตตามเงื่อนไข */}
                        {isHaircut ? (
                            <HaircutPlanController routerState={routerState} onAcceptReady={handleAcceptReady} />
                        ) : (
                            <InstallmentPlanController routerState={routerState} onAcceptReady={handleAcceptReady} />
                        )}
                    </Container>
                </MKBox>

                {/* --- โซนที่ 2: Sticky Action Footer (เชื่อมติดกับขอบล่างของ Card พอดีเป๊ะ) --- */}
                <MKBox
                    sx={({ palette: { grey }, functions: { rgba } }) => ({
                        width: "100%",
                        py: 2.5,
                        px: { xs: 3, md: 6 },
                        backgroundColor: "#ffffff",
                        borderTop: `1px solid ${rgba(grey[400], 0.2)}`,
                        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.04)",
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                        flexShrink: 0,
                        zIndex: 10,
                    })}
                >
                    {/* ข้อความแจ้งเตือนความมั่นใจทางซ้าย */}
                    <MKBox display="flex" alignItems="center" sx={{ textAlign: { xs: "center", sm: "left" } }}>
                        <Icon sx={{ color: "text.secondary", mr: 1, display: { xs: "none", sm: "block" } }}>
                            verified_user
                        </Icon>
                        <MKTypography variant="caption" color="text" fontWeight="regular">
                            โปรดตรวจสอบข้อมูลและยอดชำระให้ถูกต้องก่อนทำการยืนยัน
                        </MKTypography>
                    </MKBox>

                    {/* ปุ่ม Action ตกแต่งให้หรูหราและมีสัดส่วนพอดี */}
                    <MKButton
                        variant="gradient"
                        color={isHaircut ? "info" : "success"}
                        size="large"
                        onClick={acceptInfo.handleAccept}
                        disabled={acceptInfo.isLoading || !acceptInfo.handleAccept}
                        sx={{
                            minWidth: { xs: "100%", sm: "260px" },
                            py: 1.5,
                            px: 4,
                            borderRadius: "lg",
                            fontSize: "0.95rem",
                            fontWeight: "bold",
                            boxShadow: ({ boxShadows: { md } }) => md,
                            transition: "all 300ms cubic-bezier(0.34, 1.61, 0.7, 1)",
                            "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: ({ boxShadows: { lg } }) => lg,
                            },
                        }}
                    >
                        {isHaircut ? "ยอมรับข้อเสนอ (ปิดยอด)" : "ยอมรับข้อเสนอ (ผ่อนชำระ)"}
                    </MKButton>
                </MKBox>
            </Card>
        </MKBox>
    );
}

export default LoanPlanDetail;