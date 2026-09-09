import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import * as FormService from "../service/FormInfomationService";
import IndividualFormView from "../view/IndividualFormView";

// ultils
import validIdCard from "utils/valid-idcard";
import validMobileNo from "utils/valid-mobileno";
import validDate from "utils/valid-date";
import validNumber from "utils/valid-number";
import checkValidEmail from "utils/valid-email";


function IndividualController(props) {
    const navigate = useNavigate();

    // ==========================================
    // STATE พื้นฐาน (UI & Loading)
    // ==========================================
    const [isAlert, setIsAlert] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    // true เฉพาะกรณี backend ตอบว่าระบบปิดให้บริการ (checkSystemOpenMiddleware, HTTP 503)
    // ใช้ตัดสินใจตอนปิด alert ว่าต้องพากลับไปหน้า consent เลยหรือไม่ (ไม่ใช่ error ที่แก้แล้ว
    // ลองกรอกซ้ำในหน้านี้ได้ เพราะระบบปิดอยู่ กรอกใหม่ก็เจอ error เดิม)
    const [isSystemClosedError, setIsSystemClosedError] = useState(false);

    // ==========================================
    // STATE ข้อมูลบุคคลธรรมดา
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
    const [birthDateFull, setBirthDateFull] = useState(null);
    const [birthDateMonthYear, setBirthDateMonthYear] = useState(null);
    const [birthDateYear, setBirthDateYear] = useState(null);
    const [validBirthtDay, setValidBirthDay] = useState(false);
    const [birthDateType, setBirthDateType] = useState("");

    const [telNo, setTelNo] = useState("");
    const [validTelNo, setValidTelNo] = useState(false);

    const [email, setEmail] = useState("");
    const [validEmail, setValidEmail] = useState(false);

    const [digitNo, setDigitNo] = useState("");
    const [validDigitNo, setValidDigitNo] = useState(false);



    // ==========================================
    // HANDLERS (ฟังก์ชันจัดการการพิมพ์/คลิก)
    // ==========================================
    const handleChangeCitizenId = (e) => {
        const val = e.target.value;
        setCitizenId(val);
        if (val !== "" && (!/^\d+$/.test(val) || val.length > 13)) {
            setValidCitizenId(true);
        } else if (val.length === 13) {
            setValidCitizenId(validIdCard(val));
        } else {
            setValidCitizenId(false);
        }
    };
    const handleBlurCitizenId = () => {
        if (citizenId !== "" && (citizenId.length !== 13 || validIdCard(citizenId))) {
            setValidCitizenId(true);
        }
    };

    const handleKeyDownLaserCardId = (e) => {
        // ป้องกันไม่ให้กดปุ่มอักขระพิเศษตั้งแต่แรก (อนุญาตเฉพาะ a-z, A-Z, 0-9 และปุ่มควบคุมอื่นๆ)
        if (e.key.length === 1 && !/[a-zA-Z0-9]/.test(e.key)) {
            e.preventDefault();
        }
    };

    const handleChangeLaserCardId = (e) => {
        const rawValue = e.target.value;
        const val = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // บังคับให้ DOM อัปเดตค่าทันที (แก้ปัญหา React ไม่ re-render ถ้า state เดิมไม่เปลี่ยน)
        if (rawValue !== val) {
            e.target.value = val;
        }
        
        setLaserCardId(val);

        if (val !== "" && (!/^[A-Z]{0,2}\d{0,10}$/.test(val) || val.length > 12)) {
            setValidLaserCardId(true);
        } else if (val.length === 12) {
            setValidLaserCardId(!/^[A-Z]{2}\d{10}$/.test(val));
        } else {
            setValidLaserCardId(false);
        }
    };
    const handleBlurLaserCardId = () => {
        if (laserCardId !== "" && (laserCardId.length !== 12 || !/^[A-Z]{2}\d{10}$/.test(laserCardId))) {
            setValidLaserCardId(true);
        }
    };

    const handleChangeName = (e) => {
        const val = e.target.value;
        setName(val);
        setValidName(val !== "" && !/^[ก-๙a-zA-Z\s]+$/.test(val));
    };
    const handleBlurName = () => {
        if (name !== "" && !/^[ก-๙a-zA-Z\s]+$/.test(name)) {
            setValidName(true);
        }
    };

    const handleChangeSurname = (e) => {
        const val = e.target.value;
        setSurname(val);
        setValidSurname(val !== "" && !/^[ก-๙a-zA-Z\s]+$/.test(val));
    };
    const handleBlurSurname = () => {
        if (surname !== "" && !/^[ก-๙a-zA-Z\s]+$/.test(surname)) {
            setValidSurname(true);
        }
    };
    const handleSetDateOfBirth = (buddhistDate, type) => {
        let targetType = type;
        if (!targetType && buddhistDate) {
            const parts = buddhistDate.split("-");
            if (parts.length === 3) targetType = "full";
            else if (parts.length === 2) targetType = "monthYear";
            else if (parts.length === 1 && buddhistDate.length === 4) targetType = "year";
        }

        if (!buddhistDate) {
            if (targetType === "full") {
                setBirthDateFull(null);
            } else if (targetType === "monthYear") {
                setBirthDateMonthYear(null);
            } else if (targetType === "year") {
                setBirthDateYear(null);
            } else {
                setBirthDateFull(null);
                setBirthDateMonthYear(null);
                setBirthDateYear(null);
            }
            setDateOfBirth("");
            setValidBirthDay(true);
            return;
        }

        if (targetType === "full" || (!targetType && birthDateType === "1")) {
            setBirthDateFull(buddhistDate);
            setDateOfBirth(buddhistDate);
            setValidBirthDay(validDate(buddhistDate, "YYYY-MM-DD"));
        } else if (targetType === "monthYear") {
            setBirthDateMonthYear(buddhistDate);
            setBirthDateYear(null);

            // 2. buddhistDate 2569-07 ให้เติม 00 แทนวันที่ขาดไป เช่น 2569-07-00
            const formattedDate = `${buddhistDate}-00`;
            const isInvalidPattern = validDate(buddhistDate, "YYYY-MM");

            setDateOfBirth(formattedDate);
            setValidBirthDay(isInvalidPattern);
        } else if (targetType === "year") {
            setBirthDateYear(buddhistDate);
            setBirthDateMonthYear(null);

            // 3. buddhistDate 2569 ให้เติม 00-00 แทนวันที่และเดือนขาดไป เช่น 2569-00-00
            const formattedDate = `${buddhistDate}-00-00`;
            const isInvalidPattern = validDate(buddhistDate, "YYYY");

            setDateOfBirth(formattedDate);
            setValidBirthDay(isInvalidPattern);
        } else {
            let formattedDate = buddhistDate;
            const parts = buddhistDate.split("-");
            let isInvalid = validDate(buddhistDate, "YYYY-MM-DD");
            if (parts.length === 2) {
                formattedDate = `${buddhistDate}-00`;
                isInvalid = validDate(buddhistDate, "YYYY-MM");
            } else if (parts.length === 1 && buddhistDate.length === 4) {
                formattedDate = `${buddhistDate}-00-00`;
                isInvalid = validDate(buddhistDate, "YYYY");
            }
            setDateOfBirth(formattedDate);
            setValidBirthDay(isInvalid);
        }
    };
    const handleSetBirthDateType = (type) => {
        setBirthDateType(type);
        setDateOfBirth("");
        setBirthDateFull(null);
        setBirthDateMonthYear(null);
        setBirthDateYear(null);
        setValidBirthDay(false);
    };


    const handleChangeTelNo = (e) => {
        const val = e.target.value;
        setTelNo(val);
        if (val !== "" && (!/^\d+$/.test(val) || val.length > 10)) {
            setValidTelNo(true);
        } else if (val.length === 10) {
            setValidTelNo(validMobileNo(val));
        } else {
            setValidTelNo(false);
        }
    };
    const handleBlurTelNo = () => {
        if (telNo !== "" && (telNo.length !== 10 || validMobileNo(telNo))) {
            setValidTelNo(true);
        }
    };

    const handleChangeEmail = (e) => {
        const val = e.target.value;
        setEmail(val);
        if (val !== "" && /[\s()[\]\\/;:<>"]/.test(val)) {
            setValidEmail(true);
        } else {
            setValidEmail(false);
        }
    };
    const handleBlurEmail = () => {
        if (email !== "" && checkValidEmail(email)) {
            setValidEmail(true);
        }
    };

    const handleChangeDigitNo = (e) => {
        const rawVal = e.target.value;
        const val = rawVal.replace(/\D/g, "").slice(0, 4);
        setDigitNo(val);
        if (val !== "" && val.length !== 4) {
            setValidDigitNo(true);
        } else if (val.length === 4) {
            setValidDigitNo(validNumber(val));
        } else {
            setValidDigitNo(false);
        }
    };
    const handleBlurDigitNo = () => {
        if (digitNo !== "" && (digitNo.length !== 4 || validNumber(digitNo))) {
            setValidDigitNo(true);
        }
    };



    // ==========================================
    // LOGIC SUBMIT 
    // ==========================================
    const handleConfirmRegister = async () => {
        const tCitizenId = citizenId.trim();
        const tLaserCardId = laserCardId.trim();
        const tName = name.trim();
        const tSurname = surname.trim();
        const tTelNo = telNo.trim();
        const tDigitNo = digitNo.trim();
        const tEmail = email.trim();

        setCitizenId(tCitizenId);
        setLaserCardId(tLaserCardId);
        setName(tName);
        setSurname(tSurname);
        setTelNo(tTelNo);
        setDigitNo(tDigitNo);
        setEmail(tEmail);

        const isInvalidCitizenId = !tCitizenId || tCitizenId.length !== 13 || validIdCard(tCitizenId);
        const isInvalidLaserCardId = !tLaserCardId || tLaserCardId.length !== 12 || !/^[A-Z]{2}\d{10}$/.test(tLaserCardId);
        const isInvalidName = !tName || !/^[ก-๙a-zA-Z\s]+$/.test(tName);
        const isInvalidSurname = !tSurname || !/^[ก-๙a-zA-Z\s]+$/.test(tSurname);
        const isInvalidBirthDate = !birthDateType || !dateOfBirth || validBirthtDay;
        const isInvalidTelNo = !tTelNo || tTelNo.length !== 10 || validMobileNo(tTelNo);
        const isInvalidDigitNo = !tDigitNo || tDigitNo.length !== 4 || validNumber(tDigitNo);
        const isInvalidEmail = tEmail !== "" && checkValidEmail(tEmail);

        if (
            isInvalidCitizenId || isInvalidLaserCardId || isInvalidName || isInvalidSurname ||
            isInvalidBirthDate || isInvalidTelNo || isInvalidDigitNo || isInvalidEmail
        ) {
            setValidCitizenId(isInvalidCitizenId);
            setValidLaserCardId(isInvalidLaserCardId);
            setValidName(isInvalidName);
            setValidSurname(isInvalidSurname);
            setValidBirthDay(isInvalidBirthDate);
            setValidTelNo(isInvalidTelNo);
            setValidDigitNo(isInvalidDigitNo);
            setValidEmail(isInvalidEmail);

            setIsLoading(false);
            setIsAlert(true);
            setAlertMsg("กรุณาระบุและตรวจสอบรูปแบบข้อมูลให้ถูกต้องครบถ้วน");
            setAlertType("warning");
            return; // หยุดการทำงานถ้าข้อมูลไม่ครบหรือรูปแบบผิด
        }

        try {
            setIsLoading(true);
            const resVerify = await FormService.verifyCitizenCard({ digitNo: tDigitNo, citizenId: tCitizenId, name: tName, surname: tSurname, dateOfBirth, laserCardId: tLaserCardId, email: tEmail, birthDateType, telNo: tTelNo });
            if (resVerify.success) {
                if (typeof props.onVerifySuccess === "function") {
                    props.onVerifySuccess({
                        ...resVerify.data.targetInfo,
                        dateOfBirth: dateOfBirth || resVerify.data.targetInfo?.dateOfBirth,
                        birthDate: dateOfBirth || resVerify.data.targetInfo?.dateOfBirth,
                        citizenId: tCitizenId || resVerify.data.targetInfo?.citizenId,
                        telNo: tTelNo
                    });
                }
            } else {
                setIsLoading(false);
                setIsAlert(true);
                setAlertMsg(resVerify.message || "ข้อมูลไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง");
                setAlertType("warning");
            }

        } catch (error) {
            setIsLoading(false);
            setIsAlert(true);
            // backend (เช่น checkSystemOpenMiddleware ตอนปิดระบบ) ตอบ error กลับมาที่ key
            // "status_message" ไม่ใช่ "message" — ถ้าอ่านผิด key จะเหลือ error.message ของ axios
            // เอง (เช่น "Request failed with status code 503") ซึ่งไม่ใช่ข้อความจริงจาก backend
            const errMsg = error.response?.data?.status_message || error.response?.data?.message || error.message || "เกิดข้อผิดพลาดกรุณาติดต่อผู้ดูแลระบบ";
            setAlertMsg(errMsg);
            setAlertType("error");
            setIsSystemClosedError(error.response?.status === 503);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseAlert = (event, reason) => {
        if (reason === "clickaway") {
            return;
        }
        setIsAlert(false); // สั่งปิด Alert
        // ระบบปิดให้บริการ — ไม่ใช่ error ที่แก้แล้วลองซ้ำในหน้านี้ได้ พากลับไปหน้า consent
        // เลย (หน้า consent เช็คสถานะระบบใหม่เอง แล้วโชว์แบนเนอร์ปิดปรับปรุงให้ถูกต้อง)
        if (isSystemClosedError) {
            navigate("/drrs/consent", { replace: true });
        }
    };

    // ==========================================
    // ส่ง State และ Handlers ไปให้ View
    // ==========================================
    const state = {
        isAlert, alertMsg, alertType, isLoading,
        citizenId, validCitizenId,
        laserCardId, validLaserCardId,
        name, validName,
        surname, validSurname,
        dateOfBirth, birthDateFull, birthDateMonthYear, birthDateYear, validBirthtDay, birthDateType,
        telNo, validTelNo,
        digitNo, validDigitNo,
        email, validEmail
    };

    const handlers = {
        handleChangeCitizenId, handleBlurCitizenId,
        handleChangeLaserCardId, handleBlurLaserCardId,
        handleKeyDownLaserCardId,
        handleChangeName, handleBlurName,
        handleChangeSurname, handleBlurSurname,
        handleSetDateOfBirth, handleSetBirthDateType,
        handleChangeTelNo, handleBlurTelNo,
        handleChangeEmail, handleBlurEmail,
        handleChangeDigitNo, handleBlurDigitNo,
        handleConfirmRegister, handleCloseAlert
    };

    return <IndividualFormView state={state} handlers={handlers} consentFlag={props.consentFlag} />;
}

IndividualController.defaultProps = { consentFlag: false, onVerifySuccess: null };
IndividualController.propTypes = { consentFlag: PropTypes.bool.isRequired, onVerifySuccess: PropTypes.func };

export default IndividualController;
