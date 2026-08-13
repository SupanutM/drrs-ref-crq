import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

import { saveDebtRestructure } from "api/register";
import InstallmentPlanView from "../view/InstallmentPlanView";

function InstallmentPlanController(props) {
    const navigate = useNavigate();

    const { routerState, onAcceptReady } = props;
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isWarnModalOpen, setIsWarnModalOpen] = useState(false);
    const [warnMessage, setWarnMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [contractTemplate, setContractTemplate] = useState(null);


    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleAccept = async () => {
        try {
            setIsLoading(true);

            const payload = {
                cusTargetId: routerState?.targetInfo?.cusTargetId,
                accountNo: routerState?.targetInfo?.accountNo,
                loantype: "LT",
                planNo: routerState?.selectedPlan?.planNo,
                planDetail: {
                    principal: 10000,
                    installmentAmount: 500,
                    interest: 2,
                    installmentTerm: 20,
                    installmentFrequency: 30
                },
            };

            const apiResponse = await saveDebtRestructure(payload);

            if (apiResponse.success) {
                // console.log("บันทึกสำเร็จ กำลังเปลี่ยนหน้า...");
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
        routerState,
        isLoading,
        isModalOpen,
        isSuccessModalOpen,
        successMessage,
        isWarnModalOpen,
        warnMessage
    };

    const handlers = {
        handleAccept,
        handleCloseModal,
        handleSuccessConfirm,
        handleCloseWarnModal
    };

    // ส่ง handleAccept และ isLoading ออกไปให้ parent ใช้ render footer
    useEffect(() => {
        if (onAcceptReady) {
            onAcceptReady({ handleAccept, isLoading });
        }
    }, [isLoading]);

    return <InstallmentPlanView state={viewState} handlers={handlers} />;
}

InstallmentPlanController.propTypes = {
    routerState: PropTypes.object.isRequired,
    onAcceptReady: PropTypes.func,
};

export default InstallmentPlanController;