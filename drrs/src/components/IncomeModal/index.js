import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";

import LoadingComponent from "components/Loading/LoadingComponent";
import MKButton from "components/MKButton";
import MKInput from "components/MKInput";
import MKTypography from "components/MKTypography";

import { updateIncomeService } from "./service"; // We will create this

const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    if (String(val).includes("(")) return val;
    const numStr = String(val).replace(/\D/g, "");
    if (numStr === "") return "";
    return Number(numStr).toLocaleString("en-US");
};

function IncomeModalComponent({ isOpen, onSuccess, cusTargetId, initialData }) {
    const [totalIncome, setTotalIncome] = useState("");
    const [validTotalIncome, setValidTotalIncome] = useState(false);

    const [otherIncome, setOtherIncome] = useState("");
    const [validOtherIncome, setValidOtherIncome] = useState(false);

    const [totalCost, setTotalCost] = useState("");
    const [validTotalCost, setValidTotalCost] = useState(false);

    const [netIncome, setNetIncome] = useState("");

    const [isAlert, setIsAlert] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // รีเซ็ตค่าเมื่อเปิด/ปิด Modal
    useEffect(() => {
        if (isOpen) {
            setTotalIncome(initialData?.totalIncome ? String(initialData.totalIncome) : "");
            setOtherIncome(initialData?.otherIncome ? String(initialData.otherIncome) : "");
            setTotalCost(initialData?.totalCost ? String(initialData.totalCost) : "");
            setNetIncome(initialData?.netIncome ? String(initialData.netIncome) : "");
            setValidTotalIncome(false);
            setValidOtherIncome(false);
            setValidTotalCost(false);
        }
    }, [isOpen, initialData]);

    const isIntegerOnly = (val) => /^\d+$/.test(val);

    useEffect(() => {
        if (totalIncome && totalCost && isIntegerOnly(totalIncome) && isIntegerOnly(totalCost)) {
            const income = parseInt(totalIncome, 10);
            const other = otherIncome && isIntegerOnly(otherIncome) ? parseInt(otherIncome, 10) : 0;
            const cost = parseInt(totalCost, 10);
            if ((income + other) >= cost) {
                setNetIncome(String((income + other) - cost));
            } else {
                setNetIncome("0 (ค่าใช้จ่ายเกินรายได้)");
            }
        } else {
            setNetIncome("");
        }
    }, [totalIncome, otherIncome, totalCost]);

    const handleChangeTotalIncome = (e) => {
        const val = e.target.value.replace(/\D/g, "").slice(0, 7);
        setTotalIncome(val);

        if (val === "") {
            setValidTotalIncome(false);
        } else if (!isIntegerOnly(val) || val.length > 7) {
            setValidTotalIncome(true);
        } else {
            setValidTotalIncome(false);
            if (totalCost !== "" && isIntegerOnly(totalCost)) {
                const income = parseInt(val, 10);
                const other = otherIncome && isIntegerOnly(otherIncome) ? parseInt(otherIncome, 10) : 0;
                const cost = parseInt(totalCost, 10);
                setValidTotalCost((income + other) < cost);
            }
        }
    };
    const handleBlurTotalIncome = () => {
        if (totalIncome !== "" && (!isIntegerOnly(totalIncome) || totalIncome.length > 7)) {
            setValidTotalIncome(true);
        }
    };

    const handleChangeOtherIncome = (e) => {
        const val = e.target.value.replace(/\D/g, "").slice(0, 7);
        setOtherIncome(val);

        if (val !== "" && (!isIntegerOnly(val) || val.length > 7)) {
            setValidOtherIncome(true);
        } else {
            setValidOtherIncome(false);
            if (totalCost !== "" && isIntegerOnly(totalCost) && totalIncome !== "" && isIntegerOnly(totalIncome)) {
                const income = parseInt(totalIncome, 10);
                const other = parseInt(val, 10) || 0;
                const cost = parseInt(totalCost, 10);
                setValidTotalCost((income + other) < cost);
            }
        }
    };
    const handleBlurOtherIncome = () => {
        if (otherIncome !== "" && (!isIntegerOnly(otherIncome) || otherIncome.length > 7)) {
            setValidOtherIncome(true);
        }
    };

    const handleChangeTotalCost = (e) => {
        const val = e.target.value.replace(/\D/g, "").slice(0, 7);
        setTotalCost(val);

        if (val === "") {
            setValidTotalCost(false);
        } else if (!isIntegerOnly(val) || val.length > 7) {
            setValidTotalCost(true);
        } else {
            if (totalIncome !== "" && isIntegerOnly(totalIncome)) {
                const income = parseInt(totalIncome, 10);
                const other = otherIncome && isIntegerOnly(otherIncome) ? parseInt(otherIncome, 10) : 0;
                const cost = parseInt(val, 10);
                setValidTotalCost((income + other) < cost);
            } else {
                setValidTotalCost(false);
            }
        }
    };
    const handleBlurTotalCost = () => {
        if (totalCost !== "") {
            if (!isIntegerOnly(totalCost) || totalCost.length > 7) {
                setValidTotalCost(true);
            } else if (totalIncome !== "" && isIntegerOnly(totalIncome)) {
                const income = parseInt(totalIncome, 10);
                const other = otherIncome && isIntegerOnly(otherIncome) ? parseInt(otherIncome, 10) : 0;
                const cost = parseInt(totalCost, 10);
                setValidTotalCost((income + other) < cost);
            }
        }
    };

    const handleSave = async () => {
        const incomeVal = totalIncome && isIntegerOnly(totalIncome) ? parseInt(totalIncome, 10) : null;
        const otherIncomeVal = otherIncome && isIntegerOnly(otherIncome) ? parseInt(otherIncome, 10) : 0;
        const costVal = totalCost && isIntegerOnly(totalCost) ? parseInt(totalCost, 10) : null;
        const isInvalidTotalIncome = incomeVal === null;
        const isInvalidOtherIncome = otherIncome !== "" && !isIntegerOnly(otherIncome);
        const isInvalidTotalCost = costVal === null || (incomeVal !== null && (incomeVal + otherIncomeVal) < costVal);

        if (isInvalidTotalIncome || isInvalidTotalCost || isInvalidOtherIncome) {
            setValidTotalIncome(isInvalidTotalIncome);
            setValidOtherIncome(isInvalidOtherIncome);
            setValidTotalCost(isInvalidTotalCost);
            setAlertMsg("กรุณาระบุรายได้และค่าใช้จ่ายให้ถูกต้อง");
            setAlertType("warning");
            setIsAlert(true);
            return;
        }

        try {
            setIsLoading(true);

            const payload = {
                cusTargetId: cusTargetId,
                totalIncome: incomeVal,
                otherIncome: otherIncomeVal,
                totalCost: costVal,
                netIncome: (incomeVal + otherIncomeVal) - costVal
            };

            const response = await updateIncomeService(payload);

            if (response.success || response.status_flag) {
                onSuccess(payload);
            } else {
                setIsLoading(false);
                setIsAlert(true);
                setAlertMsg(response.message || "ไม่สามารถบันทึกข้อมูลรายได้ โปรดลองอีกครั้ง");
                setAlertType("warning");
            }
        } catch (error) {
            setIsLoading(false);
            setIsAlert(true);
            setAlertMsg(error.response?.data?.message || error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
            setAlertType("error");
        }
    };

    const handleCloseAlert = (event, reason) => {
        if (reason === "clickaway") return;
        setIsAlert(false);
    };

    return (
        <Dialog open={isOpen} maxWidth="sm" fullWidth disableEscapeKeyDown onClose={(event, reason) => { if (reason === "backdropClick") return; }}>
            <Snackbar open={isAlert} autoHideDuration={5000} onClose={handleCloseAlert} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                <Alert onClose={handleCloseAlert} severity={alertType || "success"} variant="filled" sx={{ width: "100%", color: "#fff" }}>
                    {alertMsg}
                </Alert>
            </Snackbar>

            <DialogContent>
                <MKTypography variant="h5" color="primary" align="center" mb={3}>
                    ระบุข้อมูลรายได้
                </MKTypography>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <MKTypography variant="body2" fontWeight="regular" color="dark"> รายได้รวม </MKTypography>
                        <MKInput type="tel" color="primary" label="ระบุรายได้รวม"
                            onChange={handleChangeTotalIncome} onBlur={handleBlurTotalIncome} value={formatNumber(totalIncome)} error={validTotalIncome} inputProps={{ maxLength: 9, inputMode: "numeric" }} autoComplete="off" fullWidth required />
                        {validTotalIncome && (
                            <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุรายได้รวมให้ถูกต้อง (ตัวเลขจำนวนเต็มไม่เกิน 7 หลัก) </MKTypography>
                        )}
                    </Grid>

                    <Grid item xs={12}>
                        <MKTypography variant="body2" fontWeight="regular" color="dark"> รายได้อื่น </MKTypography>
                        <MKInput type="tel" color="primary" label="ระบุรายได้อื่น"
                            onChange={handleChangeOtherIncome} onBlur={handleBlurOtherIncome} value={formatNumber(otherIncome)} error={validOtherIncome} inputProps={{ maxLength: 9, inputMode: "numeric" }} autoComplete="off" fullWidth />
                        {validOtherIncome && (
                            <MKTypography variant="caption" fontWeight="medium" color="error"> กรุณาระบุรายได้อื่นให้ถูกต้อง (ตัวเลขจำนวนเต็มไม่เกิน 7 หลัก) </MKTypography>
                        )}
                    </Grid>

                    <Grid item xs={12}>
                        <MKTypography variant="body2" fontWeight="regular" color="dark"> ค่าใช้จ่ายรวม </MKTypography>
                        <MKInput type="tel" color="primary" label="ระบุค่าใช้จ่ายรวม"
                            onChange={handleChangeTotalCost} onBlur={handleBlurTotalCost} value={formatNumber(totalCost)} error={validTotalCost} inputProps={{ maxLength: 9, inputMode: "numeric" }} autoComplete="off" fullWidth required />
                        {validTotalCost && (
                            <MKTypography variant="caption" fontWeight="medium" color="error">
                                {totalIncome && totalCost && (parseInt(totalIncome, 10) + (parseInt(otherIncome, 10) || 0)) < parseInt(totalCost, 10)
                                    ? "ค่าใช้จ่ายรวมต้องไม่มากกว่ารายได้รวม + รายได้อื่น"
                                    : "กรุณาระบุค่าใช้จ่ายรวมให้ถูกต้อง (ตัวเลขจำนวนเต็มไม่เกิน 7 หลัก)"}
                            </MKTypography>
                        )}
                    </Grid>

                    <Grid item xs={12}>
                        <MKTypography variant="body2" fontWeight="regular" color="dark"> รายได้สุทธิ </MKTypography>
                        <MKInput type="text" color="primary" label=""
                            value={formatNumber(netIncome)} autoComplete="off" fullWidth disabled />
                    </Grid>
                </Grid>

                <Grid container justifyContent="center" py={3} spacing={2}>
                    <Grid item>
                        <MKButton
                            variant="contained" color="primary"
                            onClick={handleSave}
                            disabled={validTotalIncome || validOtherIncome || validTotalCost || isLoading}
                        >
                            บันทึกรายได้
                        </MKButton>
                    </Grid>
                </Grid>

                {isLoading && (
                    <Grid container justifyContent="center">
                        <Grid item xs={12} sm={12} md={6} lg={6}>
                            <Stack sx={{ width: "100%", mb: 2 }}>
                                <LinearProgress color="primary" />
                            </Stack>
                        </Grid>
                    </Grid>
                )}
            </DialogContent>

            <LoadingComponent isOpen={isLoading} message="กำลังบันทึกข้อมูล กรุณารอสักครู่..." />
        </Dialog>
    );
}

IncomeModalComponent.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    cusTargetId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    initialData: PropTypes.shape({
        totalIncome: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        otherIncome: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        totalCost: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        netIncome: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    })
};

export default IncomeModalComponent;
