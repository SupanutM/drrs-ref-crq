import React from 'react';
import PropTypes from 'prop-types';

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import Portal from "@mui/material/Portal";
import Divider from "@mui/material/Divider";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import ModalComponent from "components/Dialog/DialogComponent";

function GenContractView({ state, handlers }) {
    const { loading, pdfData, payload, isSuccessModalOpen, isFinished } = state;
    const { handleGeneratePreview, handleDownload, handleClosePreview, handleSuccessConfirm, setIsSuccessModalOpen, navigate } = handlers;

    // ========================================================
    // 🎉 โหมดที่ 0: หน้าจอทำรายการเสร็จสิ้นสมบูรณ์ (Bank-grade Success Page)
    // แสดงขึ้นมาทันทีในกรณีที่เบราว์เซอร์ไม่อนุญาตให้ปิดแท็บตรงๆ เพื่อไม่ให้เกิดหน้าจอขาว about:blank
    // ========================================================
    if (isFinished) {
        return (
            <MKBox py={4} display="flex" justifyContent="center" width="100%">
                <Grid container justifyContent="center" px={2}>
                    <Grid item xs={12} sm={10} md={8} lg={7}>
                        <Card sx={{ p: { xs: 4, md: 6 }, textAlign: "center", boxShadow: 4, borderRadius: "xl" }}>
                            <MKTypography variant="h1" color="success" mb={2} sx={{ fontSize: "4.5rem" }}>
                                🎉
                            </MKTypography>
                            <MKTypography variant="h3" color="dark" fontWeight="bold" mb={1}>
                                ทำรายการปรับโครงสร้างหนี้เสร็จสิ้น
                            </MKTypography>
                            <MKTypography variant="body1" color="text" sx={{ mx: "auto", maxWidth: "550px", my: 2 }}>
                                ระบบได้ทำการบันทึกข้อมูลและดาวน์โหลดไฟล์เอกสารสัญญาให้ท่านเรียบร้อยแล้ว<br />
                                ท่านสามารถปิดหน้าต่างเบราว์เซอร์นี้ได้ทันที หรือเลือกกลับสู่หน้าหลักตามปุ่มด้านล่างครับ
                            </MKTypography>
                            <Divider sx={{ my: 3 }} />
                            <MKBox display="flex" justifyContent="center" gap={2} flexWrap="wrap">
                                <MKButton
                                    variant="outlined"
                                    color="dark"
                                    size="large"
                                    onClick={() => navigate && navigate("/drrs/consent")}
                                >
                                    🏠 กลับสู่หน้าเริ่มต้นลงทะเบียน
                                </MKButton>
                            </MKBox>
                        </Card>
                    </Grid>
                </Grid>
            </MKBox>
        );
    }

    // ========================================================
    // 📄 โหมดที่ 1: หน้าจอแสดงผลพรีวิว PDF (ถอดพื้นหลังเทาและ Grid ออก)
    // ========================================================
    if (pdfData.url) {
        return (
            // คืนค่าตัว Card ตรงๆ เลย เพื่อให้เต็มพื้นที่ Container ของโปรเจกต์คุณ
            <Card sx={{ p: 0, overflow: "hidden", boxShadow: 4, borderRadius: "xl", width: "100%", mt: 2 }}>

                {/* Header */}
                <MKBox display="flex" justifyContent="space-between" alignItems="center" p={2} bgColor="info">
                    <MKBox display="flex" alignItems="center" gap={1}>
                        <MKTypography variant="h5" color="white">📄</MKTypography>
                        <MKTypography variant="h5" color="white" fontWeight="bold">
                            พรีวิวเอกสาร
                        </MKTypography>
                    </MKBox>
                    <MKButton variant="text" color="white" onClick={handleClosePreview}>
                        ✕ ปิดหน้าต่าง
                    </MKButton>
                </MKBox>

                {/* Warning & Password Banner */}
                <MKBox bgColor="warning" p={1.5} textAlign="center" sx={{ px: 2 }}>
                    <MKTypography variant="body2" color="white" fontWeight="medium">
                        💡 หากไม่เห็นเอกสาร กรุณากดปุ่ม &quot;ดาวน์โหลด&quot; ด้านล่าง &nbsp;|&nbsp; 🔒 <b>รหัสผ่านเปิดไฟล์ PDF:</b> วันเดือนปีเกิด (พ.ศ.) 8 หลัก (เช่น <b>25300115</b>)
                    </MKTypography>
                </MKBox>

                {/* PDF Iframe (ขยายความสูงให้ดูเต็มตาขึ้น) */}
                <MKBox sx={{ height: { xs: "60vh", md: "80vh" }, width: "100%", backgroundColor: "#525659" }}>
                    <iframe
                        src={`${pdfData.url}#toolbar=0&view=Fit`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        title="PDF Preview"
                    />
                </MKBox>

                {/* Footer */}
                <MKBox p={3} textAlign="center" bgColor="grey-100">
                    <MKButton variant="gradient" color="success" size="large" onClick={handleDownload} sx={{ px: { xs: 2, md: 5 } }}>
                        📥 ดาวน์โหลดไฟล์เอกสาร
                    </MKButton>
                </MKBox>

                {/* 🌟 Modal แจ้งเตือนดาวน์โหลดเสร็จสิ้น พร้อมปุ่มให้ผู้ใช้กดยืนยันปิดหน้าจอ */}
                <ModalComponent
                    isOpen={isSuccessModalOpen || false}
                    onClose={() => setIsSuccessModalOpen && setIsSuccessModalOpen(false)}
                    onConfirm={handleSuccessConfirm}
                    variant="success"
                    title="บันทึกและดาวน์โหลดเอกสารเสร็จสิ้น"
                    content="ระบบได้ทำการดาวน์โหลดไฟล์สัญญาของท่านเรียบร้อยแล้ว ท่านสามารถกดตกลงเพื่อปิดหน้าต่างเบราว์เซอร์นี้ได้ทันทีครับ"
                    confirmText="ตกลง (ปิดหน้าต่าง)"
                />

            </Card>
        );
    }

    // ========================================================
    // 📝 โหมดที่ 2: หน้าจอเริ่มต้น (ถอดพื้นหลังเทาและลดความสูงลง)
    // ========================================================
    return (
        // เปลี่ยนจาก section เต็มจอ เป็น MKBox ธรรมดาที่ไม่มีสีพื้นหลัง
        <MKBox py={4} display="flex" justifyContent="center">
            <Grid container justifyContent="center" px={2}>
                <Grid item xs={12} sm={10} md={8} lg={6}>
                    <Card sx={{ p: { xs: 3, md: 5 }, textAlign: "center", boxShadow: 3, borderRadius: "xl" }}>

                        <MKTypography variant="h1" color="info" mb={2}>📝</MKTypography>

                        <MKTypography variant="h4" color="dark" fontWeight="bold" mb={1}>
                            ระบบเอกสารอิเล็กทรอนิกส์
                        </MKTypography>

                        <MKBox bgColor="grey-100" p={2} borderRadius="lg" my={3} textAlign="left">
                            <MKTypography variant="button" color="info" fontWeight="bold" display="block" mb={1}>
                                ข้อมูลเอกสารที่เตรียมสร้าง:
                            </MKTypography>
                            <MKTypography variant="body2" color="dark"><b>เดือนที่ทำสัญญา: </b> {payload?.conditionMonth || "-"}</MKTypography>
                            <MKTypography variant="body2" color="dark"><b>ปีที่ทำสัญญา: </b> {payload?.conditionYear || "-"}</MKTypography>
                            {/* ป้องกันหน้าจอขาว: ถ้า template/items ไม่ถูกส่งมา ให้นับเป็น 0 รายการ */}
                            <MKTypography variant="body2" color="dark"><b>จำนวน: </b> {payload?.items?.length || 0} รายการ</MKTypography>
                        </MKBox>

                        <Divider sx={{ my: 3 }} />

                        <MKButton
                            variant="gradient"
                            color="info"
                            size="large"
                            fullWidth
                            onClick={handleGeneratePreview}
                            disabled={loading}
                        >
                            {loading ? '⏳ กำลังเตรียมเอกสาร...' : '🔍 สร้างและดูตัวอย่างเอกสาร'}
                        </MKButton>

                    </Card>
                </Grid>
            </Grid>

            {/* หน้าต่าง Loading */}
            <Portal>
                <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 99, display: "flex", flexDirection: "column", gap: 2 }} open={loading}>
                    <CircularProgress color="inherit" size={50} />
                    <MKTypography variant="h5" color="white">กำลังสร้างเอกสาร กรุณารอสักครู่...</MKTypography>
                </Backdrop>
            </Portal>
        </MKBox>
    );
}

GenContractView.propTypes = {
    state: PropTypes.shape({
        loading: PropTypes.bool.isRequired,
        pdfData: PropTypes.shape({ url: PropTypes.string, filename: PropTypes.string }).isRequired,
        payload: PropTypes.object.isRequired,
        isSuccessModalOpen: PropTypes.bool,
        isFinished: PropTypes.bool,
    }).isRequired,
    handlers: PropTypes.shape({
        handleGeneratePreview: PropTypes.func.isRequired,
        handleDownload: PropTypes.func.isRequired,
        handleClosePreview: PropTypes.func.isRequired,
        handleSuccessConfirm: PropTypes.func,
        setIsSuccessModalOpen: PropTypes.func,
        navigate: PropTypes.func,
        // formatYearToBE: PropTypes.func.isRequired
    }).isRequired
};

export default GenContractView;