import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import PlanSummaryView from "../view/PlanSummaryView";

function PlanSummaryController({ routerState }) {
    const navigate = useNavigate();

    // ล็อคหน้าจอนี้ ไม่ให้กดปุ่มย้อนกลับ (Back button) บนเบราว์เซอร์
    useEffect(() => {
        // ดัน state ปัจจุบันทับเข้าไปใน history stack 1 ชั้น
        window.history.pushState(null, null, window.location.href);

        const handlePopState = () => {
            // เมื่อผู้ใช้กดปุ่ม Back ระบบจะดัน state กลับมาหน้าเดิมทันที (ไม่ให้ถอย)
            window.history.go(1);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);
    const [isLoading, setIsLoading] = useState(false);
    const [htmlContent, setHtmlContent] = useState("");
    const [isLoadingHtml, setIsLoadingHtml] = useState(true);

    // ดึงข้อมูลที่ส่งมาจากหน้า SelectPlan
    const { targetInfo, customerInfo, selectedAccounts } = routerState || {};

    useEffect(() => {
        const fetchHtml = async () => {
            setIsLoadingHtml(true);
            try {
                const { fetchContractHtml } = await import("api/register");

                const customer = customerInfo || targetInfo || {};

                const encryptedCustomer = {
                    cusTargetId: customer.cusTargetId
                };

                const html = await fetchContractHtml({
                    customerInfo: encryptedCustomer,
                    selectedAccounts: selectedAccounts || []
                });
                setHtmlContent(html);
            } catch (error) {
                console.error("Failed to fetch contract HTML", error);
                setHtmlContent("<div style='color:red;text-align:center;'>ไม่สามารถโหลดข้อมูลสัญญากรุณาลองใหม่อีกครั้ง</div>");
            } finally {
                setIsLoadingHtml(false);
            }
        };

        fetchHtml();
    }, [customerInfo, targetInfo, selectedAccounts]);

    const handleSubmit = async () => {
        // ผู้ใช้กด "ตกลง" ใน modal แจ้งสำเร็จแล้ว จึงพากลับหน้าเริ่มต้นทันที
        // (เดิมหน่วง 2 วิ แล้วเด้งเองเงียบๆ ผู้ใช้ไม่รู้ว่าสำเร็จ — ตอนนี้มี modal แจ้งแทน)
        navigate("/drrs/consent", { replace: true });
    };

    const state = {
        isLoading,
        isLoadingHtml,
        htmlContent,
        targetInfo,
        customerInfo,
        selectedAccounts: selectedAccounts || []
    };

    const handleCancel = async () => {
        setIsLoading(true);
        try {
            const { cancelDebtRestructure } = await import("api/register");
            const accounts = selectedAccounts ? selectedAccounts.map(a => a.accountNo) : [];
            if (accounts.length > 0) {
                await cancelDebtRestructure({ accounts });
            }
        } catch (error) {
            console.error("Failed to cancel plan", error);
        } finally {
            setIsLoading(false);
            navigate("/drrs/consent", { replace: true });
        }
    };

    const handlers = {
        handleSubmit,
        handleCancel
    };

    return <PlanSummaryView state={state} handlers={handlers} />;
}

PlanSummaryController.propTypes = {
    routerState: PropTypes.object,
};

export default PlanSummaryController;
