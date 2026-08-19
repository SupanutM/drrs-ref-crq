import React, { useState } from "react";
import PropTypes from "prop-types";
import { Document, Page, pdfjs } from 'react-pdf';
import { generateContractPdf } from "api/register";

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
    const containerRef = React.useRef(null);
    const [pdfWidth, setPdfWidth] = useState(800);

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

            const pdfBlob = await generateContractPdf({
                customerInfo: encryptedCustomer,
                selectedAccounts: selectedAccounts
            });

            const reader = new FileReader();
            reader.readAsDataURL(new Blob([pdfBlob], { type: 'application/pdf' }));
            reader.onloadend = () => {
                const now = new Date();
                const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
                const filePrefix = customer.cifNo || customer.citizenId || 'UNKNOWN';
                const filename = `${filePrefix}_${timestamp}.pdf`;

                const a = document.createElement('a');
                a.href = reader.result;
                a.setAttribute('download', filename);
                document.body.appendChild(a);
                a.click();
                a.remove();
                setIsDownloaded(true);
            };
        } catch (error) {
            console.error("Failed to generate PDF from API", error);
        }
        setIsDownloading(false);
        // Call the original submit logic (API, etc)
        handleSubmit();
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
                        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    )}

                    <MKBox id="pdf-viewer-section" mt={5} mb={2} sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>
                        <Document
                            file={`${process.env.PUBLIC_URL}/contract_522_2569.pdf`}
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
        </>
    );
}

PlanSummaryView.propTypes = {
    state: PropTypes.object.isRequired,
    handlers: PropTypes.object.isRequired,
};

export default PlanSummaryView;
