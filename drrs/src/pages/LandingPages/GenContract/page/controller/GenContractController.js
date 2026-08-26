import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from "prop-types";
import GenContractView from '../view/GenContractView';
import * as PdfService from "../services/GenContractService.js";

function GenContractController(props) {
    // eslint-disable-next-line no-unused-vars
    const navigate = useNavigate();

    const { routerState } = props;
    const [loading, setLoading] = useState(false);
    const [pdfData, setPdfData] = useState({ url: null, filename: '' });
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    const [payload] = useState({
        ...(routerState?.template || {}),
        // การันตีว่า items เป็น array เสมอ กัน backend/หน้าจอพังถ้า template ไม่ถูกส่งมา
        items: routerState?.template?.items || [],
        birthDate: routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.birthDate || '',
        dateOfBirth: routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.dateOfBirth || '',
        userPassword: routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.birthDate || ''
    });

    // 🌟 ข้อมูลนี้จะถูกส่งไปให้ Backend วาดลงใน PDF ของจริง
    // const [payload] = useState({
    //     conditionMonth: "ตุลาคม",
    //     conditionYear: "2569",
    //     items: [
    //         { desc: "ค่าบริการพัฒนาระบบ Web Application", qty: 1, price: "85,000 บาท" },
    //         { desc: "ค่าบริการติดตั้งระบบและดูแลความปลอดภัย (MA 2 ปี)", qty: 1, price: "15,000 บาท" }
    //     ]
    // });

    useEffect(() => {
        return () => {
            if (pdfData.url) URL.revokeObjectURL(pdfData.url);
        };
    }, [pdfData.url]);

    const formatYearToBE = (invoiceString) => {
        if (!invoiceString) return "";
        return invoiceString.replace(/20\d{2}/, (year) => parseInt(year, 10) + 543);
    };

    const handleGeneratePreview = async () => {
        setLoading(true);

        try {
            const sendPayload = {
                ...(payload || {}),
                birthDate: payload?.birthDate || routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.birthDate || '',
                dateOfBirth: payload?.dateOfBirth || routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.dateOfBirth || '',
                userPassword: payload?.birthDate || payload?.userPassword || routerState?.targetInfo?.dateOfBirth || routerState?.targetInfo?.birthDate || routerState?.template?.birthDate || ''
            };
            const response = await PdfService.generatePDF(sendPayload);

            const { success, base64, fileName, message } = response;
            if (!success || !base64) {
                throw new Error(message || "เซิร์ฟเวอร์ไม่ได้ส่งข้อมูลไฟล์ PDF กลับมา");
            }

            const binaryString = window.atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes.buffer], { type: 'application/pdf' });
            const localUrl = URL.createObjectURL(blob);

            setPdfData({ url: localUrl, filename: fileName });

        } catch (error) {
            console.error(error);
            const errorMessage = error.response?.data?.message || error.message;
            alert("ไม่สามารถสร้างเอกสารได้: " + errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!pdfData.url) return;
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfData.url;
        downloadLink.download = pdfData.filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // =========================================================================
        // 🌟 เมื่อดาวน์โหลดไฟล์เอกสารเสร็จ ให้เปิด Modal แจ้งยืนยันความสำเร็จ (Bank Standard)
        // =========================================================================
        setTimeout(() => {
            setIsSuccessModalOpen(true);
        }, 1200);
    };

    const handleSuccessConfirm = () => {
        setIsSuccessModalOpen(false);
        // 1. สั่งปิด tab เบราว์เซอร์ทันทีตามที่ผู้ใช้กดตกลง (จะทำงานสำเร็จ 100% เมื่อเปิดผ่านระบบหลักธนาคาร หรือ WebView/LIFF)
        window.open('', '_parent', '');
        window.open('', '_self', '');
        window.close();

        // 2. หากเบราว์เซอร์บล็อกการปิดแท็บ (เช่น ตอนทดสอบใน Dev ที่พิมพ์ URL เข้ามาเอง) 
        // ให้เปลี่ยนเข้าสู่หน้าจอ Success Page ทันที เพื่อไม่ให้ผู้ใช้ค้างอยู่ที่หน้าเดิม
        setTimeout(() => {
            if (!window.closed) {
                setIsFinished(true);
            }
        }, 200);
    };

    const handleClosePreview = () => {
        if (pdfData.url) URL.revokeObjectURL(pdfData.url);
        setPdfData({ url: null, filename: '' });
    };

    const viewState = { loading, pdfData, payload, isSuccessModalOpen, isFinished };
    const handlers = { handleGeneratePreview, handleDownload, handleClosePreview, formatYearToBE, handleSuccessConfirm, setIsSuccessModalOpen, navigate };

    return <GenContractView state={viewState} handlers={handlers} />;
}

GenContractController.propTypes = {
    routerState: PropTypes.object.isRequired
};

export default GenContractController;
