import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";

// Material Kit 2 React examples
import DefaultNavbar from "examples/Navbars/DefaultNavbar";

// Routes
import routes from "routes";

// ==========================================
// นำเข้า Controller ของแต่ละ Widget
// ==========================================
import GenContractController from "./page/controller/GenContractController";

function GenContract() {
    const navigate = useNavigate();
    const location = useLocation();
    const routerState = location.state;

    useEffect(() => {
        if (!routerState || !routerState.selectedPlan) {
            navigate("/ndrs-gsb-register/plan-detail", { replace: true });
        }
    }, [navigate, routerState]);

    if (!routerState || !routerState.selectedPlan) {
        return null;
    }

    const { selectedPlan } = routerState;

    return (
        <MKBox sx={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

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
            <MKBox sx={{ minHeight: { xs: "180px", md: "35vh" }, flexShrink: 0, width: "100%", backgroundColor: "#eb3a75", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", pt: { xs: "50px", md: "64px" }, pb: { xs: 5, md: 4 } }}>
                <Container>
                    <Grid container item xs={12} lg={8} justifyContent="center" alignItems="center" flexDirection="column" sx={{ mx: "auto", textAlign: "center" }}>
                        <MKTypography variant="h2" color="white" sx={({ breakpoints, typography: { size } }) => ({ fontSize: size["2xl"], [breakpoints.down("md")]: { fontSize: size["xl"] } })}>
                            รายละเอียดแผนการชำระหนี้
                        </MKTypography>
                        <MKTypography variant="h5" color="white" opacity={1} mt={1} mb={3} sx={({ breakpoints, typography: { size } }) => ({ [breakpoints.down("md")]: { fontSize: size["md"] } })}>
                            {/* ดึงชื่อแผนที่ผู้ใช้เลือกมาโชว์บนแบนเนอร์เลย */}
                            {selectedPlan.planName}
                        </MKTypography>
                    </Grid>
                </Container>
            </MKBox>

            <Card sx={{ mx: { xs: 2, lg: 3 }, mt: -6, mb: 2, pt: 4, pb: 4, boxShadow: ({ boxShadows: { xxl } }) => xxl, flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
                <Container sx={{ minHeight: "500px" }}>

                    <Grid container justifyContent="center" mb={4}>
                        <MKTypography variant="h5" color="primary" align="center">
                            กรุณาระบุข้อมูลสำหรับ {selectedPlan.planDesc}
                        </MKTypography>
                    </Grid>

                    <GenContractController routerState={routerState} />
                </Container>
            </Card>
        </MKBox>
    );
}

export default GenContract;