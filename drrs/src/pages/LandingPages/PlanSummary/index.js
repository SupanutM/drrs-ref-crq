import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// @mui material components
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

// Material Kit 2 React examples
import DefaultNavbar from "examples/Navbars/DefaultNavbar";

import PlanSummaryController from "./page/controller/PlanSummaryController";
import routes from "routes";

function PlanSummary() {
    const navigate = useNavigate();
    const location = useLocation();
    const routerState = location.state;

    // ตรวจสอบว่ามีข้อมูล routerState ส่งมาด้วยหรือไม่
    useEffect(() => {
        if (!routerState) {
            console.warn("[PlanSummary] No routerState found, redirecting to select-plan...");
            navigate("/drrs/consent", { replace: true });
        }
    }, [navigate, routerState]);

    if (!routerState) {
        return null;
    }

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

            {/* แบนเนอร์ด้านบน */}
            <MKBox
                sx={{
                    minHeight: { xs: "180px", md: "35vh" },
                    flexShrink: 0,
                    width: "100%",
                    background: "linear-gradient(135deg, #eb3a75 0%, #c81b53 100%)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pt: { xs: "50px", md: "64px" },
                    pb: { xs: 8, md: 4 },
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
                                [breakpoints.down("md")]: { fontSize: size["md"] },
                            })}
                        >
                            สรุปแผนการชำระหนี้
                        </MKTypography>
                        <MKTypography variant="button" color="white" opacity={0.9} fontWeight="regular" mt={0.5}>
                            กรุณาตรวจสอบรายละเอียดและยืนยันข้อเสนอ
                        </MKTypography>
                    </Grid>
                </Container>
            </MKBox>

            {/* กล่อง Card หลัก */}
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
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                })}
            >
                {/* ส่งหน้าที่ควบคุมไปยัง Controller */}
                <PlanSummaryController routerState={routerState} />
            </Card>
        </MKBox>
    );
}

export default PlanSummary;
