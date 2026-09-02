import React, { useState } from "react";
import PropTypes from "prop-types";
import DOMPurify from "dompurify";
import { Document, Page, pdfjs } from 'react-pdf';
import { generateContractPdf } from "api/register";
import { logger } from "utils/logger";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// @mui material components
import Container from "@mui/material/Container";
import Checkbox from "@mui/material/Checkbox";

// Material Kit 2 React components
import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";
import LoadingComponent from "components/Loading/LoadingComponent";
import ModalComponent from "components/Dialog/DialogComponent";


function PlanSummaryView(props) {
    const { state, handlers } = props;
    const [numPages, setNumPages] = useState(null);
    const [isAgreed, setIsAgreed] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [downloadError, setDownloadError] = useState("");
    // เก็บบัญชีที่ CBS ปฏิเสธ (Status: "REJECT") — ใช้แจ้งเตือนลูกค้าก่อนดำเนินการดาวน์โหลดต่อ
    // (backend สร้าง PDF ให้เฉพาะบัญชีที่สำเร็จ ไม่ได้บล็อกทั้ง batch)
    const [rejectedAccounts, setRejectedAccounts] = useState([]);
    const [isPartialFailModalOpen, setIsPartialFailModalOpen] = useState(false);
    // เก็บผลลัพธ์ที่ดาวน์โหลดสำเร็จไว้ชั่วคราว รอผู้ใช้กด "ดำเนินการต่อ" ใน modal แจ้งเตือนก่อน
    const [pendingDownloadResult, setPendingDownloadResult] = useState(null);
    // URL ของสัญญาจริงที่ backend สร้างมา (base64 -> blob) ใช้ทั้งโชว์บนจอและดาวน์โหลด
    // เดิมจอโชว์ไฟล์ตัวอย่างคงที่ contract_522_2569.pdf ซึ่งไม่ใช่ของลูกค้า
    const [contractPdfUrl, setContractPdfUrl] = useState(null);
    const containerRef = React.useRef(null);
    const [pdfWidth, setPdfWidth] = useState(800);

    // คืนหน่วยความจำของ blob url เมื่อออกจากหน้า
    React.useEffect(() => {
        return () => {
            if (contractPdfUrl) window.URL.revokeObjectURL(contractPdfUrl);
        };
    }, [contractPdfUrl]);

    /**
     * แปลง base64 -> Blob (application/pdf) แบบไม่บล็อกจอ
     * ใช้ fetch(data URI) ให้เบราว์เซอร์ decode เอง (native, เร็วกว่า loop charCodeAt
     * ทีละ byte มาก) — เดิม loop ~130,000 รอบต่อไฟล์ x2 ไฟล์ ทำ main thread ค้าง
     * spinner หมุนไม่ได้ตอนกดดาวน์โหลด
     */
    const base64ToBlob = async (base64) => {
        const res = await fetch(`data:application/pdf;base64,${base64}`);
        return res.blob();
    };

    React.useEffect(() => {
        if (!containerRef.current) return;

        setPdfWidth(containerRef.current.clientWidth);

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setPdfWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const {
        isLoading,
        isLoadingHtml,
        htmlContent,
        targetInfo,
        customerInfo,
        selectedAccounts
    } = state;

    const { handleSubmit, handleCancel } = handlers;

    const handleDownloadAndSubmit = async () => {
        setIsDownloading(true);
        try {
            const customer = customerInfo || targetInfo || {};

            const encryptedCustomer = {
                cusTargetId: customer.cusTargetId
            };

            // backend ตอบ 2 เวอร์ชัน:
            //   base64Preview  = ไม่มีรหัส สำหรับโชว์บนจอ (เบราว์เซอร์ไม่เด้งถามรหัส)
            //   base64Download = มีรหัสวันเกิด สำหรับดาวน์โหลดเก็บเป็นหลักฐาน
            // (fallback ไป base64 ตัวเดียวเผื่อ backend เวอร์ชันเก่า)
            // ถ้าบางบัญชีถูก CBS ปฏิเสธ (Status: "REJECT") backend จะยังส่ง success: true มา
            // (สร้าง PDF ให้เฉพาะบัญชีที่สำเร็จ) แต่แนบ hasPartialFailure/rejectedAccounts มาด้วย
            const response = await generateContractPdf({
                customerInfo: encryptedCustomer,
                selectedAccounts: selectedAccounts
            });

            const {
                success, base64, base64Preview, base64Download, fileName, message,
                hasPartialFailure, rejectedAccounts: rejectedFromApi
            } = response || {};
            const previewB64 = base64Preview || base64;
            const downloadB64 = base64Download || base64;

            // ทุกบัญชีถูก CBS ปฏิเสธ — ไม่มีไฟล์สัญญาให้ดาวน์โหลดเลย
            if (!success && !downloadB64) {
                throw new Error(message || "ไม่สามารถ ลงทะเบียนเข้าร่วมมาตรการได้กรุณาลองใหม่อีกครั้ง");
            }
            if (!downloadB64) {
                throw new Error(message || "เซิร์ฟเวอร์ไม่ได้ส่งไฟล์สัญญากลับมา");
            }

            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            const filePrefix = customer.cifNo || customer.citizenId || 'UNKNOWN';
            const filename = fileName || `${filePrefix}_${timestamp}.pdf`;

            // เก็บผลลัพธ์ไว้ก่อน ยังไม่ดาวน์โหลด/โชว์ preview จนกว่าจะผ่าน modal แจ้งเตือน (ถ้ามีบัญชี reject)
            setPendingDownloadResult({ previewB64, downloadB64, filename });

            if (hasPartialFailure && rejectedFromApi?.length > 0) {
                // มีบางบัญชีถูก CBS ปฏิเสธ — หยุดรอให้ผู้ใช้กดยืนยันดำเนินการต่อก่อน ไม่ auto-download ทันที
                setRejectedAccounts(rejectedFromApi);
                setIsDownloading(false);
                setIsPartialFailModalOpen(true);
                return;
            }

            // ทุกบัญชีสำเร็จ — ดำเนินการดาวน์โหลด/แจ้งสำเร็จตามปกติ
            finalizeDownload({ previewB64, downloadB64, filename });
        } catch (error) {
            // เดิมโค้ดแค่ console.error แล้วเรียก handleSubmit() ต่อทุกกรณี
            // (เพราะ handleSubmit อยู่นอก try/catch) ผลคือถ้าสร้างสัญญาไม่สำเร็จ
            // ผู้ใช้จะไม่ได้ไฟล์ ไม่เห็นข้อความเตือนอะไรเลย แต่ระบบบันทึกว่าทำเสร็จแล้ว
            // ผู้ใช้จะเข้าใจว่ายังไม่เสร็จแล้วกดซ้ำ
            logger.error("สร้างไฟล์สัญญาไม่สำเร็จ", error);
            setIsDownloading(false);
            setDownloadError(
                error.message || "ไม่สามารถสร้างไฟล์สัญญาได้ ระบบยังไม่บันทึกการยอมรับของท่าน กรุณากดยอมรับอีกครั้ง หากยังไม่สำเร็จ กรุณาติดต่อธนาคาร"
            );
        }
    };

    /**
     * ดาวน์โหลดไฟล์สัญญา + โชว์ preview บนจอ + แจ้งสำเร็จ แล้วเด้งไปหน้าถัดไป
     * เรียกตรงถ้าทุกบัญชีสำเร็จ หรือเรียกหลังผู้ใช้กด "ดำเนินการต่อ" ใน modal แจ้งเตือนบัญชีที่ reject
     */
    const finalizeDownload = async ({ previewB64, downloadB64, filename }) => {
        setIsDownloading(true);
        try {
            // โชว์สัญญาจริงบนจอด้วยเวอร์ชันไม่มีรหัส (เนื้อหาตรงกับไฟล์ที่ดาวน์โหลด)
            const previewBlob = await base64ToBlob(previewB64);
            const previewUrl = window.URL.createObjectURL(previewBlob);
            setContractPdfUrl(previewUrl);

            // ดาวน์โหลดด้วยเวอร์ชันมีรหัส
            const downloadBlob = await base64ToBlob(downloadB64);
            const downloadUrl = window.URL.createObjectURL(downloadBlob);
            const downloadLink = document.createElement('a');
            downloadLink.style.display = 'none';
            downloadLink.href = downloadUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // ลบ element + คืน url ของตัวดาวน์โหลด หลัง delay เล็กน้อย (สำคัญสำหรับ iOS)
            // url ของ preview ไม่ revoke ที่นี่ เพราะยังใช้โชว์บนจอ (revoke ตอนออกจากหน้า)
            setTimeout(() => {
                document.body.removeChild(downloadLink);
                window.URL.revokeObjectURL(downloadUrl);
            }, 1000);

            setIsDownloaded(true);
        } catch (error) {
            logger.error("ดาวน์โหลดไฟล์สัญญาไม่สำเร็จ", error);
            setIsDownloading(false);
            setDownloadError(
                "ไม่สามารถสร้างไฟล์สัญญาได้ ระบบยังไม่บันทึกการยอมรับของท่าน กรุณากดยอมรับอีกครั้ง หากยังไม่สำเร็จ กรุณาติดต่อธนาคาร"
            );
            return;
        }

        setIsDownloading(false);
        // สำเร็จแล้ว — โชว์ modal แจ้งสำเร็จ แล้วเด้งไปหน้าถัดไปเองใน 2 วิ (ไม่ต้องกดปุ่ม)
        setIsSuccessModalOpen(true);
        setTimeout(() => {
            handleSubmit();
        }, 2000);
    };


    // ข้อมูลลูกค้า
    // const customer = customerInfo || targetInfo || {};

    return (
        <>
            <MKBox sx={{ flexGrow: 1, overflowY: "auto", px: { xs: 1.5, md: 4, lg: 6 }, py: 3, backgroundColor: "#fff" }}>
                <Container maxWidth="md" ref={containerRef} sx={{ backgroundColor: "#fff" }}>

                    {isLoadingHtml ? (
                        <MKBox display="flex" justifyContent="center" alignItems="center" p={5}>
                            <MKTypography variant="body1">กำลังโหลดข้อมูลสัญญา...</MKTypography>
                        </MKBox>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent || "", { ADD_TAGS: ["style"], FORCE_BODY: true }) }} />
                    )}

                    <MKBox id="pdf-viewer-section" mt={5} mb={2} sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>
                        <Document
                            // ถ้าสร้างสัญญาจริงแล้วโชว์ไบต์ชุดนั้น (ตรงกับไฟล์ที่ดาวน์โหลด)
                            // ถ้ายังไม่ได้กดยอมรับ โชว์เอกสารตัวอย่างเงื่อนไขไปก่อน
                            file={contractPdfUrl || `${process.env.PUBLIC_URL}/contract_preview.pdf`}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <MKTypography variant="body2" color="text">
                                    กำลังโหลดเอกสาร...
                                </MKTypography>
                            }
                            error={
                                <MKTypography variant="body2" color="error">
                                    ไม่สามารถโหลดเอกสารได้
                                </MKTypography>
                            }
                        >
                            {Array.from(new Array(numPages), (el, index) => (
                                <MKBox key={`page_${index + 1}`} mb={2}>
                                    <Page
                                        pageNumber={index + 1}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        width={pdfWidth}
                                    />
                                </MKBox>
                            ))}
                        </Document>
                    </MKBox>

                    <MKBox display="flex" alignItems="flex-start" mt={2} mb={2} sx={{ width: "100%" }}>
                        <Checkbox
                            checked={isAgreed}
                            onChange={(e) => setIsAgreed(e.target.checked)}
                            sx={{
                                p: { xs: 0, md: 1 },
                                pt: { xs: 0.2, md: 0.3 },
                                pl: 0,
                                '& .MuiSvgIcon-root': { fontSize: { xs: '18px', md: '24px' } }
                            }}
                            disabled={isLoading || isDownloading || isDownloaded}
                        />
                        <MKTypography
                            variant="body2"
                            color="text"
                            onClick={() => { if (!isDownloaded && !isLoading && !isDownloading) setIsAgreed(!isAgreed); }}
                            sx={{ fontSize: { xs: "12px", md: "14px" }, lineHeight: 1.6, color: "#000", ml: { xs: 1, md: 0 }, cursor: "pointer", textAlign: "left" }}
                        >
                            ข้าพเจ้าได้อ่านและเข้าใจข้อความโดยครบถ้วนแล้ว เห็นว่าถูกต้องตามความประสงค์ จึงได้แสดงเจตนาตกลงผูกพันตามแผนการชำระหนี้ที่ชำระหนี้ที่ข้าพเจ้าเลือกไว้ข้างต้น รวมถึงข้อตกลงนี้ด้วยการกด &quot;ยอมรับ&quot; ด้านล่างนี้
                        </MKTypography>
                    </MKBox>

                </Container>
            </MKBox>

            <MKBox
                sx={({ palette: { grey }, functions: { rgba } }) => ({
                    width: "100%",
                    py: 2.5,
                    px: { xs: 3, md: 6 },
                    backgroundColor: "#ffffff",
                    borderTop: `1px solid ${rgba(grey[400], 0.2)}`,
                    boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.04)",
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 2,
                    flexShrink: 0,
                    zIndex: 10,
                })}
            >
                <MKButton
                    variant="outlined"
                    color="secondary"
                    size="large"
                    onClick={handleCancel}
                    disabled={isLoading || isDownloading || isDownloaded}
                    sx={{
                        minWidth: { xs: "100%", sm: "200px" },
                        py: { xs: 1.2, sm: 1.8 },
                        px: 5,
                        borderRadius: "12px",
                        fontSize: { xs: "0.95rem", sm: "1.1rem" },
                        fontWeight: "bold",
                        "&:hover": {
                            transform: "translateY(-2px)",
                        },
                        transition: "all 300ms cubic-bezier(0.34, 1.61, 0.7, 1)",
                    }}
                >
                    ยกเลิก
                </MKButton>
                <MKButton
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={() => {
                        setIsDownloadModalOpen(true);
                    }}
                    disabled={isLoading || isDownloading || isDownloaded || selectedAccounts.length === 0 || !isAgreed}
                    sx={{
                        minWidth: { xs: "100%", sm: "200px" },
                        py: { xs: 1.2, sm: 1.8 },
                        px: 5,
                        borderRadius: "12px",
                        fontSize: { xs: "0.95rem", sm: "1.1rem" },
                        fontWeight: "bold",
                        "&:hover": {
                            transform: "translateY(-2px)",
                        },
                        transition: "all 300ms cubic-bezier(0.34, 1.61, 0.7, 1)",
                    }}
                > ยอมรับ </MKButton>
            </MKBox>

            <LoadingComponent isOpen={isLoading || isDownloading} />
            <ModalComponent
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                onConfirm={() => {
                    setIsDownloadModalOpen(false);
                    handleDownloadAndSubmit();
                }}
                title="ดาวน์โหลดสัญญา"
                content={
                    <>
                        ท่านต้องการดาวน์โหลดสัญญาเพื่อเก็บไว้เป็นหลักฐาน และดำเนินการต่อหรือไม่?
                        <br /><br />
                        <MKTypography component="span" color="error" sx={{ fontSize: { xs: "12px", md: "inherit" } }}>
                            หมายเหตุ: รหัสผ่านสำหรับเปิดไฟล์คือ วันเดือนปีเกิดของท่าน ในรูปแบบ DDMMYYYY (ปี พ.ศ.)
                        </MKTypography>
                    </>
                }
                confirmText="ดาวน์โหลด"
                hideCancel={true}
            />

            <ModalComponent
                isOpen={downloadError !== ""}
                onClose={() => setDownloadError("")}
                onConfirm={() => setDownloadError("")}
                variant="error"
                title="สร้างไฟล์สัญญาไม่สำเร็จ"
                content={downloadError}
                confirmText="ปิด"
                hideCancel={true}
            />

            {/* บางบัญชีถูก CBS ปฏิเสธ (Status: "REJECT") — แจ้งเตือนก่อนดำเนินการต่อดาวน์โหลด
                สัญญาของบัญชีที่สำเร็จ (backend สร้าง PDF ให้เฉพาะบัญชีที่ CBS รับแล้วเท่านั้น) */}
            <ModalComponent
                isOpen={isPartialFailModalOpen}
                onClose={() => setIsPartialFailModalOpen(false)}
                onConfirm={() => {
                    setIsPartialFailModalOpen(false);
                    if (pendingDownloadResult) finalizeDownload(pendingDownloadResult);
                }}
                variant="warning"
                title="บางบัญชีไม่สามารถลงทะเบียนกับ CBS ได้"
                content={
                    <>
                        บัญชีดังต่อไปนี้ไม่สามารถลงทะเบียนแผนปรับโครงสร้างหนี้กับระบบ CBS ได้ กรุณาติดต่อธนาคาร:
                        <MKBox component="ul" mt={1} mb={0} sx={{ textAlign: "left", pl: 3 }}>
                            {rejectedAccounts.map((r) => (
                                <li key={r.accountNo}>
                                    <MKTypography component="span" variant="body2" color="text">
                                        {r.accountNo}{r.message ? ` — ${r.message}` : ""}
                                    </MKTypography>
                                </li>
                            ))}
                        </MKBox>
                        <br />
                        ท่านสามารถดำเนินการต่อเพื่อดาวน์โหลดสัญญาสำหรับบัญชีที่สำเร็จได้
                    </>
                }
                confirmText="ดำเนินการต่อ"
                hideCancel={true}
            />

            <ModalComponent
                isOpen={isSuccessModalOpen}
                variant="success"
                title="ทำรายการสำเร็จ"
                content={
                    <>
                        ระบบบันทึกการยอมรับแผนการชำระหนี้ของท่านเรียบร้อยแล้ว และดาวน์โหลดไฟล์สัญญาให้ท่านแล้ว
                        <br /><br />
                        <MKTypography component="span" color="text" sx={{ fontSize: { xs: "12px", md: "inherit" } }}>
                            หากไม่พบไฟล์ กรุณาตรวจสอบที่โฟลเดอร์ดาวน์โหลดของอุปกรณ์ท่าน
                        </MKTypography>
                    </>
                }
                showActions={false}
            />
        </>
    );
}

PlanSummaryView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default PlanSummaryView;
