import PropTypes from "prop-types";
import { useState } from "react";
// import { useNavigate } from "react-router-dom";

// นำเข้า Service กลาง
import * as FormService from "../service/FormInfomationService";

// นำเข้า View ของนิติบุคคล
import JuristicFormView from "../view/JuristicFormView";

// ultils
import validCharater from "utils/valid-character";
import validLength from "utils/valid-lenght";
import validMobileNo from "utils/valid-mobileno";

function JuristicController(props) {
    // const navigate = useNavigate();

    // ==========================================
    // STATE พื้นฐาน (UI & Loading)
    // ==========================================
    const [isAlert, setIsAlert] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");
    const [alertType, setAlertType] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // ==========================================
    // STATE ข้อมูลนิติบุคคล (สั้นลงมากเพราะตัดของบุคคลธรรมดาทิ้ง)
    // ==========================================
    const [citizenId, setCitizenId] = useState(""); // ใช้เก็บเลขนิติบุคคล
    const [validCitizenId, setValidCitizenId] = useState(false);

    const [name, setName] = useState(""); // ใช้เก็บชื่อบริษัท/นิติบุคคล
    const [validName, setValidName] = useState(false);

    // // ที่อยู่ (ซ่อนไว้เหมือนเดิม)
    // const [homeNo, setHomeNo] = useState("-");
    // const [road, setRoad] = useState("-");
    // const [subDistrict, setSubDistrict] = useState("-");
    // const [district, setDistrict] = useState("-");
    // const [province, setProvince] = useState("-");
    // const [postCode, setPostCode] = useState("-");

    const [telNo, setTelNo] = useState("");
    const [validTelNo, setValidTelNo] = useState(false);

    const [digitNo, setDigitNo] = useState("");
    const [validDigitNo, setValidDigitNo] = useState(false);

    // ==========================================
    // HANDLERS (ฟังก์ชันจัดการการพิมพ์/คลิก)
    // ==========================================
    const handleChangeCitizenId = (e) => {
        // นิติบุคคลอาจจะมี format เลขทะเบียนที่ต่างออกไป ตรงนี้เช็คแค่ความยาวหรือให้มีค่าก็พอครับ
        setValidCitizenId(!e.target.value || validLength(e.target.value, 13) ? true : false);
        setCitizenId(e.target.value);
        setValidCitizenId(false);
    };
    const handleChangeName = (e) => {
        setValidName(!e.target.value || validCharater(e.target.value));
        setName(e.target.value);
        setValidName(false);
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


    // ==========================================
    // LOGIC SUBMIT (นิติบุคคล)
    // ==========================================
    const handleConfirmRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const tCitizenId = citizenId.trim();
        const tName = name.trim();
        const tTelNo = telNo.trim();
        const tDigitNo = digitNo.trim();

        setCitizenId(tCitizenId);
        setName(tName);
        setTelNo(tTelNo);
        setDigitNo(tDigitNo);

        if (!tCitizenId || !tName || !tTelNo || !tDigitNo) {
            setIsLoading(false);
            setIsAlert(true);
            setAlertMsg("กรุณาระบุข้อมูลให้ครบถ้วน หรือถูกต้อง");
            setAlertType("warning");

            if (!tCitizenId) setValidCitizenId(true);
            if (!tName) setValidName(true);
            if (!tTelNo) setValidTelNo(true);
            if (!tDigitNo) setValidDigitNo(true);
            return;
        }

        try {
            setIsLoading(true);
            const resVerify = await FormService.verifyCitizenCard({ digitNo: tDigitNo, citizenId: tCitizenId, name: tName });

            if (resVerify.success) {
                if (typeof props.onVerifySuccess === "function") {
                    const payload = resVerify.data.targetInfo || { citizenId: tCitizenId };
                    props.onVerifySuccess({ ...payload, telNo: tTelNo });
                }
            }

        } catch (error) {
            setIsLoading(false);
            setIsAlert(true);
            setAlertMsg("เกิดข้อผิดพลาดจากระบบหลังบ้าน");
            setAlertType("error");
        } finally {
            setIsLoading(false); // ปิด Progress Bar
        }
    };

    // ฟังก์ชันสำหรับสั่งปิด Popup
    const handleCloseAlert = (event, reason) => {
        if (reason === "clickaway") {
            return; // ป้องกันไม่ให้เผลอคลิกพื้นที่ว่างแล้ว Popup หาย
        }
        setIsAlert(false); // สั่งปิด Alert
    };

    const state = {
        isAlert, alertMsg, alertType, isLoading,
        citizenId, validCitizenId, name, validName,
        telNo, validTelNo, digitNo, validDigitNo
    };

    const handlers = {
        handleChangeCitizenId, handleChangeName, handleChangeTelNo,
        handleChangeDigitNo,
        handleConfirmRegister, handleCloseAlert
    };

    return <JuristicFormView state={state} handlers={handlers} consentFlag={props.consentFlag} />;
}

JuristicController.defaultProps = { consentFlag: false, onVerifySuccess: null };
JuristicController.propTypes = { consentFlag: PropTypes.bool.isRequired, onVerifySuccess: PropTypes.func };

export default JuristicController;