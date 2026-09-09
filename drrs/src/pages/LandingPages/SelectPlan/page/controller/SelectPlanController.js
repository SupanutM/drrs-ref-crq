import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { saveDebtRestructure } from "api/register";
import { inquiryAccount } from "api/cbsRegister";
import { logger } from "utils/logger";
import SelectPlanView from "../view/SelectPlanView";

import Box from "@mui/material/Box";

function SelectPlanController(props) {
    const navigate = useNavigate();
    const { routerState } = props;

    // Global Plans array from targetInfo (removed, now per-account)
    // const plans = routerState?.targetInfo?.masterPlan || [];

    // Tab State (removed)
    // const [activeTabIndex, setActiveTabIndex] = useState(0);
    // const activePlan = plans[activeTabIndex] || null;

    // Per-account Plan Selection State
    // Format: { "accountNo1": "planNo", "accountNo2": "planNo" }
    const [selectedPlans, setSelectedPlans] = useState({});

    // Accounts array (assuming targetInfo has an array, or fallback to single accountNo)
    const accounts = routerState?.targetInfo?.accounts ||
        (routerState?.targetInfo?.accountNo ? [{ accountNo: routerState.targetInfo.accountNo, outstanding: 10000 }] : []);

    const [netIncome, setNetIncome] = useState(Number(routerState?.targetInfo?.netIncome || 0));
    const [incomeData, setIncomeData] = useState({
        totalIncome: routerState?.targetInfo?.totalIncome || "",
        otherIncome: routerState?.targetInfo?.otherIncome || "",
        totalCost: routerState?.targetInfo?.totalCost || "",
        netIncome: routerState?.targetInfo?.netIncome || ""
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [contractTemplate, setContractTemplate] = useState(null);
    const [isWarnModalOpen, setIsWarnModalOpen] = useState(false);
    const [warnMessage, setWarnMessage] = useState("");
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

    const handlePlanSelect = (accountNo, planNo) => {
        setSelectedPlans(prev => {
            const next = { ...prev };
            if (next[accountNo] === planNo) {
                // Deselect if already selected
                delete next[accountNo];
            } else {
                // Select new plan
                next[accountNo] = planNo;
            }
            return next;
        });
    };

    const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);

    // เก็บ ScheduledNextDate ต่อบัญชี (จาก CBS Inquiry Account) เพื่อคำนวณกำหนดการชำระหนี้
    // Format: { "accountNo1": "20260902", ... }
    const [scheduledDates, setScheduledDates] = useState({});
    // เก็บบัญชีที่ CBS Inquiry ตอบ Status: "REJECT" (เช่น "Account not Found.") — ใช้ทำการ์ดสีเทา
    // (เลือกไม่ได้) พร้อมข้อความแดงแจ้งลูกค้า กันเลือกแผนของบัญชีที่ CBS หาไม่เจอไปก่อนเลย
    // Format: { "accountNo1": true, ... }
    const [inquiryFailedAccounts, setInquiryFailedAccounts] = useState({});

    // ตอนเข้าหน้าเลือกแผน — ยิง inquiry account ไปที่ CBS ทุกบัญชีของลูกค้า
    // (ไม่ throw ต่อ ไม่บล็อกหน้าถ้า CBS ล้มเหลว — เป็นแค่การอัปเดตข้อมูลล่วงหน้า)
    useEffect(() => {
        accounts.forEach((acc) => {
            if (!acc?.accountNo) return;
            inquiryAccount({ accountNo: acc.accountNo, source: "select-plan" })
                .then((res) => {
                    const scheduledNextDate = res?.data?.ScheduledNextDate;
                    if (scheduledNextDate) {
                        setScheduledDates((prev) => ({ ...prev, [acc.accountNo]: scheduledNextDate }));
                    }
                    // CBS ตอบ HTTP 200 มาได้แม้ Status เป็น "REJECT" (เช่น "Account not Found.")
                    // ต้องเช็ค Status ในตัว body เสมอ ไม่ใช่แค่เช็คว่า request สำเร็จ
                    if (res?.data?.Status && res.data.Status !== 'SUCCESS') {
                        setInquiryFailedAccounts((prev) => ({ ...prev, [acc.accountNo]: true }));
                    }
                })
                .catch((error) => {
                    logger.error(`Inquiry account ล้มเหลวสำหรับบัญชี ${acc.accountNo}`, error);
                });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAccept = () => {
        const selectedAccountNos = Object.keys(selectedPlans);
        if (selectedAccountNos.length === 0 || accounts.length === 0) return;

        // Check if there are any unselected accounts that are not registered
        const selectableAccounts = accounts.filter(acc => !acc.isRegistered);
        if (selectedAccountNos.length < selectableAccounts.length) {
            setIsIncompleteModalOpen(true);
            return;
        }

        proceedWithSave();
    };

    const handleProceedIncomplete = () => {
        setIsIncompleteModalOpen(false);
        proceedWithSave();
    };

    const handleCloseIncompleteModal = () => {
        setIsIncompleteModalOpen(false);
    };

    const proceedWithSave = async (overrideNetIncome = null) => {
        const currentNetIncome = overrideNetIncome !== null ? overrideNetIncome : netIncome;

        const selectedAccountNos = Object.keys(selectedPlans);
        if (selectedAccountNos.length === 0 || accounts.length === 0) return;

        // Helper: ตรวจสอบว่าแผนนั้นต้องเช็ครายได้หรือไม่ (ใช้ String() ป้องกัน type mismatch จาก API)
        const needsIncomeCheck = (acc) => {
            const selectedPlanNo = selectedPlans[acc.accountNo];
            if (!selectedPlanNo) return false;
            const activePlan = acc.masterPlan?.find(p => p.planNo === selectedPlanNo);
            // isCheckIncome = '0' หรือ 0 → ไม่ต้องเช็ค, อื่นๆ (1, '1', undefined) → ต้องเช็ค (safe zone)
            return String(activePlan?.isCheckIncome) !== '0';
        };

        // แยกบัญชีที่เลือกออกเป็น 2 กลุ่ม: ต้องเช็ครายได้ vs ไม่ต้องเช็ค
        const accountsNeedCheck = accounts.filter(acc => selectedPlans[acc.accountNo] && needsIncomeCheck(acc));

        // ตรวจสอบว่าเป็นการเลือกแผนครั้งแรกหรือไม่ (ไม่มีบัญชีที่เคยลงทะเบียน)
        const isFirstTime = accounts.every(acc => !acc.isRegistered);

        // ดึงยอดขั้นต่ำของบัญชี = ยอดผ่อนชำระ (paymentAmount) ของแผนที่เลือกจริง
        // (ไม่ใช้ acc.minAmount เดิม เพราะเป็นค่าระดับบัญชี ไม่แยกตามแผน — HC มี min_amount เป็น NULL
        // แต่ LT มีค่าจริง ทำให้ค่าไม่ตรงกับแผนที่ลูกค้าเลือกจริง)
        const getSelectedPlanAmount = (acc) => {
            const selectedPlanNo = selectedPlans[acc.accountNo];
            if (!selectedPlanNo) return 0;
            const activePlan = acc.masterPlan?.find(p => p.planNo === selectedPlanNo);
            return Number(activePlan?.details?.[0]?.paymentAmount || 0);
        };

        // คำนวณยอดขั้นต่ำรวมเฉพาะบัญชีที่ต้องเช็ครายได้
        let totalMinAmount = accountsNeedCheck.reduce((sum, acc) => sum + getSelectedPlanAmount(acc), 0);

        // ตรวจสอบว่ามีการเลือกแผนผ่อนชำระ (LT) หรือไม่ (แผนที่ loanType ไม่ใช่ "HC" คือ LT)
        const hasInstallmentPlan = accountsNeedCheck.some(acc => {
            const selectedPlanNo = selectedPlans[acc.accountNo];
            if (!selectedPlanNo) return false;
            const activePlan = acc.masterPlan?.find(p => p.planNo === selectedPlanNo);
            return activePlan?.loanType !== "HC";
        });

        if (hasInstallmentPlan) {
            const oldInstallments = routerState?.targetInfo?.oldInstallments || [];
            const oldInstallmentAmount = oldInstallments
                .filter(old => !selectedAccountNos.includes(old.accountNo))
                .reduce((sum, old) => sum + Number(old.installmentAmount || 0), 0);

            totalMinAmount += oldInstallmentAmount;
        }

        // ตรวจสอบรายได้สุทธิ: เช็คเฉพาะเมื่อมีบัญชีที่ต้องการตรวจสอบ (isCheckIncome != 0)
        if (accountsNeedCheck.length > 0 && currentNetIncome < totalMinAmount) {
            // ถ้ายอดรวมถูกบวกเพิ่มจากบัญชีเก่า ให้แจ้งให้ผู้ใช้ทราบด้วย
            const currentPlanMinAmount = accountsNeedCheck.reduce((sum, acc) => sum + getSelectedPlanAmount(acc), 0);
            const showOldInstallmentWarning = hasInstallmentPlan && totalMinAmount > currentPlanMinAmount && !isFirstTime;

            const warnMsg = (
                <Box>
                    <Box sx={{ fontSize: { xs: "16px", sm: "inherit" } }}>
                        รายได้สุทธิไม่เพียงพอชำระหนี้<br />
                        (รายได้สุทธิปัจจุบัน: {currentNetIncome.toLocaleString()} บาท / ต้องมียอดขั้นต่ำรวม: {totalMinAmount.toLocaleString()} บาท)<br />
                            กรุณาระบุรายได้อื่นๆ เพื่อประกอบการพิจารณา หรือติดต่อสาขา
                    </Box>
                    {showOldInstallmentWarning && (
                        <Box sx={{ fontSize: { xs: "10px", sm: "12px" }, color: "#F44335", textAlign: "left", mt: 2 }}>
                            *หมายเหตุ: โดยยอดขั้นต่ำนี้ได้รวมภาระจากบัญชีที่คุณเคยลงทะเบียนผ่อนชำระไว้ก่อนหน้านี้แล้ว
                        </Box>
                    )}
                </Box>
            );

            setWarnMessage(warnMsg);
            setIsWarnModalOpen(true);
            return;
        }

        try {
            setIsLoading(true);

            // API Payload - construct array of selected plans only for accounts that have a selection
            const payload = accounts
                .filter(acc => selectedPlans[acc.accountNo])
                .map(acc => {
                    const planNo = selectedPlans[acc.accountNo];
                    const activePlan = acc.masterPlan?.find(p => p.planNo === planNo);
                    return {
                        cusTargetId: routerState?.targetInfo?.cusTargetId,
                        accountNo: acc.accountNo,
                        loantype: activePlan?.loanType || "LT",
                        planNo: planNo,
                        planDetail: activePlan?.loanType === "HC" ? {
                            amount: activePlan?.details?.[0]?.paymentAmount || activePlan?.details?.[0]?.amount || 500
                        } : {
                            principal: activePlan?.details?.[0]?.principal || 10000,
                            installmentAmount: activePlan?.details?.[0]?.paymentAmount || activePlan?.details?.[0]?.installmentAmount || 500,
                            interest: activePlan?.details?.[0]?.interest || 2,
                            installmentTerm: activePlan?.details?.[0]?.installmentTerms || activePlan?.details?.[0]?.installmentTerm || 20,
                            installmentFrequency: activePlan?.details?.[0]?.installmentFrequency || 30
                        },
                    };
                });

            // Pass array payload if API supports it, or adapt here
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
                setSuccessMessage("บันทึกข้อมูลชำระหนี้ และ แผนการปรับปรุงโครงสร้างหนี้สำเร็จ !");
                setIsSuccessModalOpen(true);
            } else {
                const errorMsg = apiResponse?.message || "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง";
                setWarnMessage(errorMsg);
                setIsWarnModalOpen(true);
            }
        } catch (error) {
            console.error("Submit Plan Error:", error);
            const errorMessage = error.response?.data?.message || error.message || "ระบบขัดข้อง ไม่สามารถบันทึกข้อมูลได้ในขณะนี้";

            // Fallback: ดักจับ Error จาก Backend API แล้วนำมาจัด Format สวยงามบน Frontend
            if (errorMessage.includes("รายได้สุทธิไม่เพียงพอชำระหนี้")) {
                // สกัดค่าตัวเลขจาก Error Message ของ Backend แทนการดึงผ่าน Object (เพราะ data อาจจะหายตอน Build)
                const matchNetIncome = errorMessage.match(/รายได้สุทธิปัจจุบัน:\s*([\d,]+)/);
                const matchMinAmount = errorMessage.match(/ต้องมียอดขั้นต่ำรวม:\s*([\d,]+)/);

                const displayNetIncome = matchNetIncome ? matchNetIncome[1] : currentNetIncome.toLocaleString();
                const displayMinAmount = matchMinAmount ? matchMinAmount[1] : totalMinAmount.toLocaleString();
                const isOldInstallmentIncluded = errorMessage.includes("เคยลงทะเบียนผ่อนชำระ") && !isFirstTime;

                const formattedWarnMsg = (
                    <Box>
                        <Box sx={{ fontSize: { xs: "16px", sm: "inherit" } }}>
                            รายได้สุทธิไม่เพียงพอชำระหนี้<br />
                            (รายได้สุทธิปัจจุบัน: {displayNetIncome} บาท / ต้องมียอดขั้นต่ำรวม: {displayMinAmount} บาท)<br />
                            กรุณาระบุรายได้อื่นๆ เพื่อประกอบการพิจารณา หรือติดต่อสาขา
                        </Box>
                        {isOldInstallmentIncluded && (
                            <Box sx={{ fontSize: { xs: "10px", sm: "12px" }, color: "#F44335", textAlign: "left", mt: 2 }}>
                                *หมายเหตุ: โดยยอดขั้นต่ำนี้ได้รวมภาระจากบัญชีที่คุณเคยลงทะเบียนผ่อนชำระไว้ก่อนหน้านี้แล้ว 
                            </Box>
                        )}
                    </Box>
                );
                setWarnMessage(formattedWarnMsg);
            } else {
                setWarnMessage(errorMessage);
            }

            setIsWarnModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessConfirm = () => {
        setIsLoading(true);
        setIsSuccessModalOpen(false);

        // สร้างข้อมูลบัญชีที่เลือก สำหรับส่งไปหน้า PlanSummary
        const selectedAccountsData = accounts
            .filter(acc => selectedPlans[acc.accountNo])
            .map(acc => {
                const planNo = selectedPlans[acc.accountNo];
                const activePlan = acc.masterPlan?.find(p => p.planNo === planNo);
                const detail = activePlan?.details?.[0] || {};
                const isHaircut = activePlan?.loanType === "HC";

                return {
                    accountNo: acc.accountNo,
                    planNo: planNo,
                    // ชื่อประเภทสินเชื่อ (เช่น "สินเชื่อผ่อนชำระ") มาจาก tbl_mt_master_plan.desc
                    // ผ่าน masterPlanService.js -> activePlan.planDesc (ไม่ใช่ detail.desc ซึ่งเป็นแค่ยอดเงิน/งวด)
                    loanType: acc.loanType || activePlan?.planDesc || (isHaircut ? "HC" : "LT"),
                    contractDate: acc.contractDate || "",
                    loanAmount: acc.loanAmount || acc.outstanding || "",
                    principal: detail.principal || acc.principal || "",
                    interest: detail.interest || acc.interest || "",
                    isHaircut: isHaircut,
                    paymentAmount: detail.paymentAmount || detail.amount || detail.installmentAmount || "",
                    // ช่อง "ชำระภายในวันที่" ของแผน Haircut ใช้ expireDate (tbl_account_cus_target.expire_date)
                    // ตรงๆ เท่านั้น — ไม่ใช้ ScheduledNextDate จาก CBS แล้ว
                    expireDate: detail.expireDate || "",
                    startMonth: detail.startDate || "",
                    endMonth: detail.endDate || "",
                    installments: detail.installments || [],
                };
            });

        setTimeout(() => {
            navigate("/drrs/plan-summary", {
                replace: true, // ป้องกันการกด Back กลับมาหน้า SelectPlan
                state: {
                    ...routerState,
                    selectedPlans: selectedPlans,
                    template: contractTemplate,
                    targetInfo: routerState?.targetInfo,
                    customerInfo: routerState?.customerInfo || routerState?.targetInfo,
                    selectedAccounts: selectedAccountsData
                }
            });
        }, 1000);
    };

    const handleCloseWarnModal = () => {
        setIsWarnModalOpen(false);
        setWarnMessage("");
    };

    const handleOpenIncomeModal = () => setIsIncomeModalOpen(true);
    const handleCloseIncomeModal = () => setIsIncomeModalOpen(false);

    const handleIncomeSuccess = (payload) => {
        setIsIncomeModalOpen(false);
        setNetIncome(payload.netIncome);
        setIncomeData(payload); // Cache the new data

        // อัปเดต routerState ให้มีค่ารายได้ใหม่พร้อมสำหรับหน้าถัดไป
        if (routerState && routerState.targetInfo) {
            routerState.targetInfo.netIncome = payload.netIncome;
            routerState.targetInfo.totalIncome = payload.totalIncome;
            routerState.targetInfo.otherIncome = payload.otherIncome;
            routerState.targetInfo.totalCost = payload.totalCost;
        }

        // กลับไปหน้า plan-preview ตาม flow ที่ถูกต้อง
        // (user จะกด confirm ใหม่ → SelectPlan จะ validate income อีกรอบ)
        navigate("/drrs/plan-preview", { state: routerState, replace: true });
    };

    const viewState = {
        routerState,
        accounts,
        scheduledDates,
        inquiryFailedAccounts,
        selectedPlans,
        isLoading,
        isSuccessModalOpen,
        successMessage,
        isWarnModalOpen,
        warnMessage,
        isIncomeModalOpen,
        netIncome,
        incomeData,
        isIncompleteModalOpen
    };

    const handlers = {
        handlePlanSelect,
        handleAccept,
        handleSuccessConfirm,
        handleCloseWarnModal,
        handleOpenIncomeModal,
        handleCloseIncomeModal,
        handleIncomeSuccess,
        handleProceedIncomplete,
        handleCloseIncompleteModal
    };

    return <SelectPlanView state={viewState} handlers={handlers} />;
}

SelectPlanController.propTypes = {
    routerState: PropTypes.object.isRequired,
};

export default SelectPlanController;
