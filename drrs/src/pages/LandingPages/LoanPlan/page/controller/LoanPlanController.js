import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

import LoanPlanView from "../view/LoanPlanView";
import { checkPlan } from "api/verify";

function LoanPlanController(props) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    // ใช้ Snackbar+Alert (มีเส้นนับถอยหลัง) แทน alert() ของเบราว์เซอร์ — ให้ตรงกับ UI
    // pattern เดียวกันกับหน้า form-register/income-modal ทุกจุดที่แสดง error ให้ user
    const [isAlert, setIsAlert] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState("");
    // true เฉพาะกรณี backend ตอบว่าระบบปิดให้บริการ (checkSystemOpenMiddleware, HTTP 503)
    const [isSystemClosedError, setIsSystemClosedError] = useState(false);

    const loanPlans = props.routerState?.targetInfo?.masterPlan || [];
    const accountNo = props.routerState?.targetInfo?.accountNo;

    const handleSelectPlan = async (selectedPlan) => {
        setIsLoading(true);

        try {
            // (ใช้ ID หรือ planNo จากฐานข้อมูลของคุณ)

            const apiResponse = await checkPlan({ accountNo: accountNo, planNo: selectedPlan.planNo });

            if (apiResponse.status) {
                navigate("/drrs/plan-detail", {
                    state: {
                        ...(props.routerState || {}),
                        selectedPlan: selectedPlan
                    }
                });
            } else {
                setIsAlert(true);
                setAlertMsg("ไม่สามารถเลือกแผนนี้ได้ กรุณาลองใหม่อีกครั้ง");
                setAlertType("warning");
            }
        } catch (error) {
            console.error("Select Plan Error:", error);
            // backend (เช่น checkSystemOpenMiddleware ตอนปิดระบบ) ตอบ error กลับมาที่ key
            // "status_message" ไม่ใช่ "message" — ถ้าอ่านผิด key จะเหลือ error.message ของ axios
            // เอง (เช่น "Request failed with status code 503") ซึ่งไม่ใช่ข้อความจริงจาก backend
            const errMsg = error.response?.data?.status_message || error.response?.data?.message || "ระบบขัดข้อง ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้";
            setIsAlert(true);
            setAlertMsg(errMsg);
            setAlertType("error");
            setIsSystemClosedError(error.response?.status === 503);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseAlert = (event, reason) => {
        if (reason === "clickaway") return;
        setIsAlert(false);
        // ระบบปิดให้บริการ — ไม่ใช่ error ที่แก้แล้วลองซ้ำในหน้านี้ได้ พากลับไปหน้า consent
        // เลย (หน้า consent เช็คสถานะระบบใหม่เอง แล้วโชว์แบนเนอร์ปิดปรับปรุงให้ถูกต้อง)
        if (isSystemClosedError) {
            setIsSystemClosedError(false);
            navigate("/drrs/consent", { replace: true });
        }
    };

    const viewState = {
        routerState: props.routerState,
        loanPlans, // 🌟 ส่ง masterPlan ที่แกะมาได้ โยนลงไปให้ View วาดหน้าจอเลย
        isLoading,
        isAlert,
        alertMsg,
        alertType
    };

    const handlers = {
        handleSelectPlan,
        handleCloseAlert
    };

    return <LoanPlanView state={viewState} handlers={handlers} />;
}

LoanPlanController.propTypes = {
    routerState: PropTypes.object
};

export default LoanPlanController;