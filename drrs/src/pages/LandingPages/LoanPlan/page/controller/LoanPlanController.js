import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

import LoanPlanView from "../view/LoanPlanView";
import { checkPlan } from "api/verify";

function LoanPlanController(props) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

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
                alert("ไม่สามารถเลือกแผนนี้ได้ กรุณาลองใหม่อีกครั้ง");
            }
        } catch (error) {
            console.error("Select Plan Error:", error);
            alert("ระบบขัดข้อง ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้");
        } finally {
            setIsLoading(false);
        }
    };

    const viewState = {
        routerState: props.routerState,
        loanPlans, // 🌟 ส่ง masterPlan ที่แกะมาได้ โยนลงไปให้ View วาดหน้าจอเลย
        masterPlanDetail: props.routerState?.targetInfo?.masterPlanDetail || [],
        isLoading
    };

    const handlers = {
        handleSelectPlan
    };

    return <LoanPlanView state={viewState} handlers={handlers} />;
}

LoanPlanController.propTypes = {
    routerState: PropTypes.object
};

export default LoanPlanController;