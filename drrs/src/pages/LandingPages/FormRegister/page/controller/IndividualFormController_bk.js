import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

// นำเข้า Service กลางที่เราเพิ่งสร้าง
import * as FormService from "../service/FormInfomationService";

// นำเข้า View (HTML) สำหรับบุคคลธรรมดา (เดี๋ยวเราจะสร้างไฟล์นี้ในสเตปถัดไป)
import IndividualFormView from "../view/IndividualFormView";

// ultils
import validIdCard from "utils/valid-idcard";
import validMobileNo from "utils/valid-mobileno";
import validCharater from "utils/valid-character";
import validLength from "utils/valid-lenght";
import validDate from "utils/valid-date";
import validNumber from "utils/valid-number";

function IndividualController(props) {
    const navigate = useNavigate();

    // ==========================================
    // 1. STATE พื้นฐาน (UI & Loading)
    // ==========================================
    const [isAlert, setIsAlert] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // ==========================================
    // 2. STATE ข้อมูลบุคคลธรรมดา
    // ==========================================
    const [citizenId, setCitizenId] = useState("");
    const [validCitizenId, setValidCitizenId] = useState(false);

    const [laserCardId, setLaserCardId] = useState("");
    const [validLaserCardId, setValidLaserCardId] = useState(false);

    const [name, setName] = useState("");
    const [validName, setValidName] = useState(false);

    const [surname, setSurname] = useState("");
    const [validSurname, setValidSurname] = useState(false);

    const [dateOfBirth, setDateOfBirth] = useState(null);
    const [validBirthtDay, setValidBirthDay] = useState(false);

    // ข้อมูลที่อยู่
    const [homeNo, setHomeNo] = useState("-");
    const [validHomeNo, setValidHomeNo] = useState(false);
    const [road, setRoad] = useState("-");
    const [validRoad, setValidRoad] = useState(false);
    const [subDistrict, setSubDistrict] = useState("-");
    const [validSubDistrict, setValidSubDistrict] = useState(false);
    const [district, setDistrict] = useState("-");
    const [validDistrict, setValidDistrict] = useState(false);
    const [province, setProvince] = useState("-");
    const [validProvince, setValidProvince] = useState(false);
    const [postCode, setPostCode] = useState("-");
    const [validPostCode, setValidPostCode] = useState(false);

    const [telNo, setTelNo] = useState("");
    const [validTelNo, setValidTelNo] = useState(false);

    const [digitNo, setDigitNo] = useState("");
    const [validDigitNo, setValidDigitNo] = useState(false);

    const [totalIncome, setTotalIncome] = useState("");
    const [validTotalIncome, setValidTotalIncome] = useState(false);
    const [totalCost, setTotalCost] = useState("");
    const [validTotalCost, setValidTotalCost] = useState(false);
    const [netIncome, setNetIncome] = useState("");

    // ==========================================
    // 3. ระบบคำนวณรายได้อัตโนมัติ (useEffect)
    // ==========================================
    useEffect(() => {
        if (totalIncome && totalCost) {
            const sum = parseFloat(totalIncome) + parseFloat(totalCost);
            setNetIncome(sum);
        } else {
            setNetIncome("");
        }
    }, [totalIncome, totalCost]);

    // ==========================================
    // 4. HANDLERS (ฟังก์ชันจัดการการพิมพ์/คลิก)
    // ==========================================
    const handleChangeCitizenId = (e) => {
        setValidCitizenId(!e.target.value || validIdCard(e.target.value) || validLength(e.target.value, 13) ? true : false);
        setCitizenId(e.target.value);
        setValidCitizenId(false);
    };
    const handleChangeLaserCardId = (e) => {
        setValidLaserCardId(!e.target.value || validLength(e.target.value, 12));
        setLaserCardId(e.target.value);
        setValidLaserCardId(false);
    };
    const handleChangeName = (e) => {
        setValidName(!e.target.value || validCharater(e.target.value));
        setName(e.target.value);
        setValidName(false);
    };
    const handleChangeSurname = (e) => {
        setValidSurname(!e.target.value || validCharater(e.target.value));
        setSurname(e.target.value);
        setValidSurname(false);
    };
    const handleSetDateOfBirth = (buddhistDate) => {
        setDateOfBirth(buddhistDate);
        setValidBirthDay(validDate(buddhistDate, "YYYY-MM-DD"));
        setValidBirthDay(false);
    };

    // ที่อยู่และเบอร์โทร
    const handleChangeHomeNo = (e) => { setValidHomeNo(!e.target.value); setHomeNo(e.target.value); };
    const handleChangeRoad = (e) => { setValidRoad(!e.target.value); setRoad(e.target.value); };
    const handleChangeSubDistrict = (e) => { setValidSubDistrict(!e.target.value); setSubDistrict(e.target.value); };
    const handleChangeDistrict = (e) => { setValidDistrict(!e.target.value); setDistrict(e.target.value); };
    const handleChangeProvince = (e) => { setValidProvince(!e.target.value); setProvince(e.target.value); };
    const handleChangePostCode = (e) => {
        setValidPostCode(!e.target.value || validLength(e.target.value, 5) || validNumber(e.target.value));
        setPostCode(e.target.value);
    };

    const handleChangeTelNo = (e) => {
        setValidTelNo(!e.target.value || validMobileNo(e.target.value) || validLength(e.target.value, 10));
        setTelNo(e.target.value);
        setValidTelNo(false);
    };
    const handleChangeDigitNo = (e) => {
        setValidDigitNo(validLength(e.target.value, 4));
        setDigitNo(e.target.value);
        setValidDigitNo(false);
    };

    // รายได้ / ค่าใช้จ่าย
    const handleChangeTotalIncome = (e) => {
        setValidTotalIncome(!e.target.value || !validNumber(e.target.value));
        setTotalIncome(e.target.value);
        setValidTotalIncome(false);
    };
    const handleChangeTotalCost = (e) => {
        setValidTotalCost(!e.target.value || !validNumber(e.target.value));
        setTotalCost(e.target.value);
        setValidTotalCost(false);
    };

    // ==========================================
    // 5. LOGIC SUBMIT (แบบ Clean Architecture)
    // ==========================================
    const handleConfirmRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // 5.1 ตรวจสอบว่ากรอกข้อมูลครบไหม
        if (!citizenId || !name || !surname || !dateOfBirth || !telNo || !digitNo) {
               navigate("/ndrs/plan", {
                    state: { },
                });

            // setIsLoading(false);
            // setIsAlert(true);
            // setAlertMsg("กรุณาระบุข้อมูลให้ครบถ้วน หรือถูกต้อง");
            // setAlertType("warning");

            // if (!citizenId) setValidCitizenId(true);
            // if (!name) setValidName(true);
            // if (!surname) setValidSurname(true);
            // if (!dateOfBirth) setValidBirthDay(true);
            // if (!telNo) setValidTelNo(true);
            // if (!digitNo) setValidDigitNo(true);
            // if (!totalIncome) setValidTotalIncome(true);
            // if (!totalCost) setValidTotalCost(true);
            // return; // หยุดการทำงานถ้าข้อมูลไม่ครบ
        }

        try {
            // 5.2 เช็คลงทะเบียนซ้ำผ่าน Service
            const resCheckDup = await FormService.checkDuplicateUser(citizenId);

            if (resCheckDup.status_flag && resCheckDup.count.check_dup > 0) {
                setIsLoading(false);
                navigate("/ndrs/result", {
                    state: {
                        consentFlag: props.consentFlag,
                        isCustGsb: false,
                        isCustTarget: false,
                        debtRepaymentDesc: "",
                        custType: "บุคคลธรรมดา",
                        isDupplicate: true,
                        accountNo: "",
                    },
                });
                return;
            } else if (!resCheckDup.status_flag) {
                throw new Error(resCheckDup.status_message);
            }

            // 5.3 ตรวจสอบสถานะบัตร (DOPA) ผ่าน Service
            const resVerify = await FormService.verifyCitizenCard({ citizenId, name, surname, dateOfBirth, laserCardId });

            if (!resVerify.status_flag || resVerify.status_code !== "0") {
                setIsLoading(false);
                setIsAlert(true);
                setAlertMsg("สถานะบัตรประจำตัวประชาชน :" + resVerify.status_message);
                setAlertType("warning");
                return;
            }

            // 5.4 ตรวจสอบลูกค้าเป้าหมาย (Target) ผ่าน Service
            const resTarget = await FormService.checkCustomerTarget(citizenId, digitNo);

            if (!resTarget.status_flag) {
                setIsLoading(false);
                setIsAlert(true);
                setAlertMsg(resTarget.status_message === "Target Not Found." ? "บัญชีสินเชื่อของท่านไม่ได้รับสิทธิ์เข้าร่วมมาตรการ" :
                    resTarget.status_message === "Verifyied Number is incorrect." ? "กรุณาระบุรหัสตัวเลข 4 ตัวที่ได้รับจากธนาคาร ให้ถูกต้อง" : resTarget.status_message);
                setAlertType(resTarget.status_message === "Target Not Found." || resTarget.status_message === "Verifyied Number is incorrect." ? "warning" : "error");
                return;
            }

            // 5.5 บันทึกข้อมูล (Submit) ผ่าน Service
            const rawData = { citizenId, laserCardId, name, surname, dateOfBirth, telNo, homeNo, road, subDistrict, district, province, postCode };
            const resSubmit = await FormService.submitRegistration(rawData, resTarget.data_list);

            if (resSubmit.status) {
                setIsLoading(false);
                navigate("/ndrs/result", {
                    state: {
                        consentFlag: props.consentFlag,
                        isCustGsb: true,
                        isCustTarget: true,
                        debtRepaymentDesc: resTarget.data_list[0].debt_repayment_name,
                        custType: "บุคคลธรรมดา",
                        isDupplicate: false,
                        accountNo: resSubmit.accountListStr,
                    },
                });
            } else {
                throw new Error("ท่านทำรายการไม่สำเร็จ กรุณาติดต่อสาขา");
            }

        } catch (error) {
            setIsLoading(false);
            setIsAlert(true);
            setAlertMsg(error.message || "เกิดข้อผิดพลาดจากระบบหลังบ้าน");
            setAlertType("error");
        }
    };

    // ฟังก์ชันสำหรับสั่งปิด Popup
    const handleCloseAlert = (event, reason) => {
        if (reason === "clickaway") {
            return; // ป้องกันไม่ให้เผลอคลิกพื้นที่ว่างแล้ว Popup หาย
        }
        setIsAlert(false); // สั่งปิด Alert
    };

    // ==========================================
    // 6. ส่ง State และ Handlers ไปให้ View
    // ==========================================
    const state = {
        isAlert, alertMsg, alertType, isLoading,
        citizenId, validCitizenId, laserCardId, validLaserCardId,
        name, validName, surname, validSurname,
        dateOfBirth, validBirthtDay,
        homeNo, validHomeNo, road, validRoad, subDistrict, validSubDistrict,
        district, validDistrict, province, validProvince, postCode, validPostCode,
        telNo, validTelNo, digitNo, validDigitNo,
        totalIncome, validTotalIncome, totalCost, validTotalCost, netIncome
    };

    const handlers = {
        handleChangeCitizenId, handleChangeLaserCardId, handleChangeName, handleChangeSurname,
        handleSetDateOfBirth, handleChangeHomeNo, handleChangeRoad, handleChangeSubDistrict,
        handleChangeDistrict, handleChangeProvince, handleChangePostCode, handleChangeTelNo,
        handleChangeDigitNo, handleChangeTotalIncome, handleChangeTotalCost, handleConfirmRegister,
        handleCloseAlert
    };

    return <IndividualFormView state={state} handlers={handlers} consentFlag={props.consentFlag} />;
}

IndividualController.defaultProps = { consentFlag: false };
IndividualController.propTypes = { consentFlag: PropTypes.bool.isRequired };

export default IndividualController;