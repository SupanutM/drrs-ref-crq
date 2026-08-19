import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import HaircutPlanView from "../view/HaircutPlanView";
import { paymentChannels } from "../services/LoanPlanDetailService"
import { saveDebtRestructure } from "api/register";


function HaircutPlanController(props) {
    const navigate = useNavigate();

    const { routerState, onAcceptReady } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [contractTemplate, setContractTemplate] = useState(null);

    const [isWarnModalOpen, setIsWarnModalOpen] = useState(false);
    const [warnMessage, setWarnMessage] = useState("");

    const [paymentMethod, setPaymentMethod] = useState("");
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setPaymentMethod("");
    };

    const handleInputChange = (event) => {
        setPaymentMethod(event.target.value);
    };

    const handleAccept = async () => {
        try {
            setIsLoading(true);

            const payload = {
                cusTargetId: routerState?.targetInfo?.cusTargetId,
                accountNo: routerState?.targetInfo?.accountNo,
                loantype: "HC",
                planNo: routerState?.selectedPlan?.planNo,
                planDetail: {
                    amount: 500
                },
            };

            const apiResponse = await saveDebtRestructure(payload);

            if (apiResponse.success) {
                setContractTemplate({
                    conditionMonth: apiResponse.template.conditionMonth,
                    conditionYear: apiResponse.template.conditionYear,
                    items: apiResponse.template.items,
                    birthDate: routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || '',
                    dateOfBirth: routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || '',
                    citizenId: routerState?.targetInfo?.citizenId || ''
                });
                setSuccessMessage(apiResponse.message || "บันทึกข้อมูลแผนการปรับปรุงโครงสร้างหนี้สำเร็จ!");
                setIsSuccessModalOpen(true);
                setIsLoading(false);

            } else {
                setIsLoading(false);
                const errorMsg = apiResponse?.message || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหมี่อีกครั้ง";
                setWarnMessage(errorMsg);
                setIsWarnModalOpen(true)
            }

        } catch (error) {
            setIsLoading(false);
            console.error("Submit Installment Plan Error:", error);
            const errorMessage = error.response?.data?.message || error.message || "ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้";
            setWarnMessage(errorMessage);
            setIsWarnModalOpen(true);
        }
    };

    const handleSuccessConfirm = () => {
        setIsLoading(true);
        setIsSuccessModalOpen(false);

        setTimeout(() => {
            navigate("/drrs/contract", {
                state: {
                    ...routerState,
                    template: contractTemplate
                }
            });
        }, 1000);
    }
    const handleCloseWarnModal = () => {
        setIsWarnModalOpen(false);
        setWarnMessage("");
    };


    const viewState = {
        routerState, isLoading,
        isModalOpen, isSuccessModalOpen, successMessage,
        isWarnModalOpen, warnMessage,
        paymentMethod, paymentChannels
    };

    const handlers = {
        handleAccept, handleInputChange,
        handleCloseModal, handleSuccessConfirm, handleCloseWarnModal
    };

    // ส่ง handleAccept และ isLoading ออกไปให้ parent ใช้ render footer
    useEffect(() => {
        if (onAcceptReady) {
            onAcceptReady({ handleAccept, isLoading });
        }
    }, [isLoading]);

    return <HaircutPlanView state={viewState} handlers={handlers} />;
}

HaircutPlanController.propTypes = {
    routerState: PropTypes.object.isRequired,
    onAcceptReady: PropTypes.func,
};

export default HaircutPlanController;