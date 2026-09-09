import React, { useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

// นำเข้า View 
import ConsentView from "../view/ConsentView";

import { checkCloseSystem } from "api/master";
import { clearToken } from "utils/authToken";


function ConsentController({ onVersionLoad }) {
    const navigate = useNavigate();
    const [checked, setChecked] = React.useState(false);
    const [isAlert, setIsAlert] = React.useState(false);
    const [isClose, setIsClose] = React.useState("");
    const [appVersion, setAppVersion] = React.useState("1.0.0");

    const handleChange = (event) => {
        setChecked(event.target.checked);
    };

    const handleAcceptConsent = () => {
        if (checked) {
            navigate("/drrs/form", { state: { consentFlag: checked } });
        } else {
            setIsAlert(true);
            setTimeout(() => setIsAlert(false), 10000);
        }
    };

    const getCheckCloseSystem = useCallback(async () => {
        const parms = {
            channel: "DRRS",
        };

        try {
            const response = await checkCloseSystem(parms);
            if (response?.status && response?.data?.length > 0) {
                const isSystemOpen = response.data[0].status_flag;
                setIsClose(isSystemOpen ? "ON" : "OFF");
                const ver = response.data[0].appVersion || "1.0.0";
                setAppVersion(ver);
                if (typeof onVersionLoad === "function") onVersionLoad(ver);
            } else {
                setIsClose("OFF");
            }
        } catch (error) {
            // เมื่อ API ล้มเหลว (network error, 500 ฯลฯ) ให้ fail-safe เป็นสถานะปิดระบบ
            // ป้องกันไม่ให้ผู้ใช้เข้าฟอร์มลงทะเบียนได้ในสถานะที่ไม่แน่ใจ
            setIsClose("OFF");
        }
    }, [onVersionLoad]);

    useEffect(() => {
        // เริ่มต้นใหม่ทุกครั้งที่มาหน้า consent — ล้าง session token เก่าทิ้ง
        clearToken();
        getCheckCloseSystem();
    }, [getCheckCloseSystem]);

    const state = {
        checked,
        isAlert,
        isClose,
        appVersion
    };

    const handlers = {
        handleChange,
        handleAcceptConsent,
    };

    return <ConsentView state={state} handlers={handlers} isClose={isClose} />;
}

ConsentController.defaultProps = { consentFlag: false, onVersionLoad: null };
ConsentController.propTypes = { consentFlag: PropTypes.bool, onVersionLoad: PropTypes.func };

export default ConsentController;