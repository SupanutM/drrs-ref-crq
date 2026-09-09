import React from "react";
import PropTypes from "prop-types";

// @mui material components
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Card from "@mui/material/Card";
import Radio from "@mui/material/Radio";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import ModalComponent from "components/Dialog/DialogComponent";
import LoadingComponent from "components/Loading/LoadingComponent";
import IncomeModalComponent from "components/IncomeModal";
import InstallmentSchedule from "components/InstallmentSchedule";
import { isPastDate } from "utils/day";

function SelectPlanView(props) {
    const { state, handlers } = props;
    const {
        accounts,
        scheduledDates,
        inquiryFailedAccounts,
        selectedPlans,
        isLoading,
        isSuccessModalOpen,
        successMessage,
        isWarnModalOpen,
        warnMessage,
        isIncomeInsufficientError
    } = state;

    const {
        handlePlanSelect,
        handleAccept,
        handleSuccessConfirm,
        handleCloseWarnModal,
        handleConfirmWarnModal,
        handleCloseIncomeModal,
        handleIncomeSuccess
    } = handlers;

    // Check if at least one plan is selected
    const isAnySelected = Object.keys(selectedPlans).length > 0;

    return (
        <>
            {/* โซนที่ 1: พื้นที่เนื้อหาที่สามารถเลื่อน Scroll ได้ */}
            <MKBox sx={{ flexGrow: 1, overflowY: "auto", px: { xs: 2.5, md: 5, lg: 6 }, py: 4, backgroundColor: "#f8f9fa" }}>
                <Container maxWidth="md" sx={{ minHeight: "380px" }}>

                    {accounts.map((acc, index) => {
                        // CBS Inquiry ตอบ Status ไม่ใช่ "SUCCESS" (เช่น "Account not Found.") — ทำการ์ดสีเทา
                        // เลือกไม่ได้ทั้งบัญชี พร้อมข้อความแดงแจ้งลูกค้าให้ติดต่อสาขา/Call Center
                        const isInquiryFailed = !!inquiryFailedAccounts?.[acc.accountNo];

                        return (
                        <MKBox key={acc.accountNo} mb={5}>
                            <MKTypography variant="h5" color="dark" mb={2} sx={{ fontSize: { xs: "0.95rem", md: "1.25rem" } }}>
                                {index + 1}. บัญชีเลขที่ {acc.accountNo}
                                {acc.isRegistered && (
                                    <MKTypography component="span" variant="body2" color="error" ml={2}>
                                        (บัญชีนี้ได้ทำการเลือกลงทะเบียนไปแล้ว)
                                    </MKTypography>
                                )}
                            </MKTypography>

                            {isInquiryFailed && (
                                <MKTypography variant="body2" color="error" fontWeight="bold" mb={2}>
                                    ไม่พบข้อมูลบัญชี กรุณาติดต่อสาขา หรือ MyMo Call Center 1143
                                </MKTypography>
                            )}

                            <Grid container spacing={2}>
                                {(acc.masterPlan && acc.masterPlan.length > 0) ? (
                                    acc.masterPlan.map((plan) => {
                                        const isSelected = selectedPlans[acc.accountNo] === plan.planNo;
                                        const isHaircut = plan.loanType === "HC";

                                        // Fallback and Generic Property Support
                                        const detail = plan.details?.[0] || plan || {};
                                        const paymentAmount = detail.paymentAmount || detail.amount || detail.installmentAmount || 0;
                                        const installmentTerms = detail.installmentTerms || detail.installmentTerm || 0;
                                        // ScheduledNextDate จาก CBS Inquiry Account (ยิงตอนเข้าหน้านี้) — ใช้เป็นวันเริ่มต้นคำนวณกำหนดการ (แผนผ่อนชำระเท่านั้น)
                                        const scheduledNextDate = scheduledDates?.[acc.accountNo];
                                        // วันหมดอายุจาก tbl_account_cus_target.expire_date — ใช้กับแผน Haircut เท่านั้น (ไม่ใช้ ScheduledNextDate)
                                        const expireDate = detail.expireDate;
                                        // แผน Haircut ที่เลยกำหนด expireDate แล้ว — เลือกไม่ได้ (การ์ดสีเทาเหมือน isRegistered)
                                        const isExpired = isHaircut && isPastDate(expireDate);
                                        const isRegistered = acc.isRegistered || isInquiryFailed || isExpired;

                                        return (
                                            <Grid item xs={12} key={plan.planNo}>
                                                <Card
                                                    onClick={() => !isRegistered && handlePlanSelect(acc.accountNo, plan.planNo)}
                                                    sx={({ palette: { primary, white, grey }, borders: { borderWidth } }) => ({
                                                        cursor: isRegistered ? "not-allowed" : "pointer",
                                                        backgroundColor: isRegistered ? grey[100] : white.main,
                                                        border: `${borderWidth[2]} solid ${isSelected ? primary.main : grey[300]}`,
                                                        opacity: isRegistered ? 0.7 : 1,
                                                        transition: "all 0.2s ease-in-out",
                                                        "&:hover": {
                                                            borderColor: isRegistered ? grey[300] : (isSelected ? primary.main : grey[400]),
                                                            transform: isRegistered ? "none" : "translateY(-2px)",
                                                            boxShadow: isRegistered ? "none" : 3
                                                        }
                                                    })}
                                                >
                                                    <MKBox display="flex" alignItems="flex-start" p={2.5}>
                                                        <MKBox mt={0.5} mr={2}>
                                                            <Radio
                                                                checked={isSelected}
                                                                disabled={isRegistered}
                                                                onClick={(e) => {
                                                                    // Prevent event bubbling to Card
                                                                    e.stopPropagation();
                                                                    if (!isRegistered) handlePlanSelect(acc.accountNo, plan.planNo);
                                                                }}
                                                                value={plan.planNo || ""}
                                                                name={`radio-plan-${acc.accountNo}`}
                                                                color="primary"
                                                                sx={{ padding: 0 }}
                                                            />
                                                        </MKBox>
                                                        <MKBox flex={1}>
                                                            <MKTypography variant="h6" color="dark" fontWeight="bold" sx={{ fontSize: { xs: "0.875rem", md: "1rem" } }}>
                                                                {isHaircut ? `ปิดบัญชีเลขที่ ${acc.accountNo}` : "ผ่อนชำระ"}
                                                            </MKTypography>
                                                            <MKTypography variant="body2" color="text" mt={1}>
                                                                <InstallmentSchedule
                                                                    isHaircut={isHaircut}
                                                                    paymentAmount={paymentAmount}
                                                                    installmentTerms={installmentTerms}
                                                                    scheduledNextDate={scheduledNextDate}
                                                                    expireDate={expireDate}
                                                                />
                                                            </MKTypography>
                                                            {isExpired && (
                                                                <MKTypography variant="caption" color="error" fontWeight="bold" display="block" mt={0.5}>
                                                                    เลยกำหนดวันที่ปิดบัญชีแล้ว กรุณาติดต่อสาขา หรือ MyMo Call Center 1143
                                                                </MKTypography>
                                                            )}
                                                        </MKBox>
                                                    </MKBox>
                                                </Card>
                                            </Grid>
                                        );
                                    })
                                ) : (
                                    <Grid item xs={12}>
                                        <MKBox p={3} textAlign="center" bgColor="grey-100" borderRadius="lg">
                                            <MKTypography variant="body2" color="text">
                                                ไม่พบข้อมูลแผนการชำระหนี้สำหรับบัญชีนี้ในระบบ (กรุณาติดต่อเจ้าหน้าที่)
                                            </MKTypography>
                                        </MKBox>
                                    </Grid>
                                )}
                            </Grid>
                        </MKBox>
                        );
                    })}

                </Container>
            </MKBox>

            {/* โซนที่ 2: Sticky Action Footer */}
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
                <MKBox display="flex" alignItems="center" sx={{ textAlign: { xs: "center", sm: "left" } }}>
                    <Icon sx={{ color: "text.secondary", mr: 1, display: { xs: "none", sm: "block" } }}>
                        info
                    </Icon>
                    <MKTypography variant="caption" color="text" fontWeight="regular">
                        กรุณาเลือกแผนการชำระหนี้อย่างน้อย 1 บัญชีเพื่อดำเนินการต่อ
                        <br />
                        รายได้สุทธิปัจจุบัน: <b>{(state.netIncome || 0).toLocaleString()}</b> บาท
                    </MKTypography>
                </MKBox>

                <MKButton
                    variant="gradient"
                    color="primary"
                    size="large"
                    onClick={handleAccept}
                    disabled={state.isLoading || !isAnySelected}
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
                    ยืนยันแผนการชำระหนี้
                </MKButton>
            </MKBox>

            {/* Modals & Loading */}
            <ModalComponent
                isOpen={isSuccessModalOpen}
                onClose={handleSuccessConfirm}
                onConfirm={handleSuccessConfirm}
                variant="success"
                title={successMessage || "บันทึกข้อมูลแผนสำเร็จ!"}
                content="ระบบกำลังพาท่านไปยังหน้าสัญญา..."
                confirmText="ดำเนินการต่อ"
            />

            <ModalComponent
                isOpen={isWarnModalOpen}
                onClose={handleCloseWarnModal}
                onConfirm={handleConfirmWarnModal}
                variant="warning"
                title={warnMessage || "เกิดข้อผิดพลาดในการบันทึกข้อมูล"}
                content=""
                confirmText={isIncomeInsufficientError ? "ระบุรายได้อื่นๆ คลิก !" : "ตกลง"}
            />

            <ModalComponent
                isOpen={state.isIncompleteModalOpen}
                onClose={handlers.handleCloseIncompleteModal}
                onConfirm={handlers.handleProceedIncomplete}
                variant="warning"
                title={
                    <MKTypography component="span" color="inherit" fontWeight="bold" sx={{ fontSize: { xs: "16px", sm: "inherit" } }}>
                        ท่านแจ้งความประสงค์ไม่ครบทุกบัญชี
                    </MKTypography>
                }
                content=""
                confirmText="ยืนยันทำรายการเฉพาะบัญชีที่เลือก"
                confirmColor="success"
                cancelText="เลือกบัญชีเพิ่มเติม"
                cancelColor="warning"
                buttonDirection="column"
            />

            <IncomeModalComponent
                isOpen={state.isIncomeModalOpen}
                onClose={handleCloseIncomeModal}
                onSuccess={handleIncomeSuccess}
                cusTargetId={state.routerState?.targetInfo?.cusTargetId}
                initialData={state.incomeData}
            />

            <LoadingComponent isOpen={isLoading || false} />
        </>
    );
}

SelectPlanView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default SelectPlanView;
