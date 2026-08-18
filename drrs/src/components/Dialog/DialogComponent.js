import React from "react";
import PropTypes from "prop-types";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKButton from "components/MKButton";

function ModalComponent(props) {
    const {
        isOpen, onClose, onConfirm, title, content,
        confirmColor, isConfirmDisabled, confirmText, hideCancel,
        variant, cancelText, cancelColor, buttonDirection
    } = props;

    // ฟังก์ชันจัดการหน้าตา Modal ตามประเภท
    const renderContent = () => {
        if (variant === "confirm") {
            return content;
        }

        let icon = "";
        let color = "info";
        let defaultTitle = title;

        if (variant === "success") {
            icon = "✅";
            color = "success";
            defaultTitle = title || "ทำรายการสำเร็จ";
        } else if (variant === "warning") {
            icon = "⚠️";
            color = "warning";
            defaultTitle = title || "แจ้งเตือน";
        } else if (variant === "error") {
            icon = "❌";
            color = "error";
            defaultTitle = title || "เกิดข้อผิดพลาด";
        }

        return (
            <MKBox display="flex" flexDirection="column" alignItems="center" gap={2} mt={2} mb={0}>
                <MKTypography variant="h1" color={color}>
                    {icon}
                </MKTypography>
                <MKTypography variant="h5" color={color} textAlign="center">
                    {defaultTitle}
                </MKTypography>
                {content && content !== "" && (
                    <MKTypography variant="body2" color="text" textAlign="center">
                        {content}
                    </MKTypography>
                )}
            </MKBox>
        );
    };

    // ฟังก์ชันเลือกสีปุ่ม
    const getConfirmColor = () => {
        if (confirmColor) return confirmColor;
        if (variant === "success") return "success";
        if (variant === "warning") return "warning";
        if (variant === "error") return "error";
        return "primary";
    };

    const shouldHideCancel = hideCancel || (variant !== "confirm" && !cancelText);
    const isColumn = buttonDirection === "column";

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="xs">
            
            {variant === "confirm" && title && (
                <DialogTitle>
                    <MKTypography variant="h5" component="span">
                        {title}
                    </MKTypography>
                </DialogTitle>
            )}

            <DialogContent>
                {renderContent()}
            </DialogContent>

            <DialogActions sx={{ pb: 2, px: 3, justifyContent: "center", flexDirection: isColumn ? "column" : "row", flexWrap: "wrap", gap: 1 }}>

                {!shouldHideCancel && (
                    <MKButton
                        variant={cancelColor ? "gradient" : "outlined"}
                        color={cancelColor || "secondary"}
                        onClick={onClose}
                        sx={{ flex: isColumn ? "none" : 1, width: isColumn ? "100%" : "auto", minWidth: "120px" }}
                    >
                        {cancelText || "ยกเลิก"}
                    </MKButton>
                )}

                <MKButton
                    variant="gradient"
                    color={getConfirmColor()}
                    onClick={onConfirm}
                    disabled={isConfirmDisabled}
                    sx={{ flex: isColumn ? "none" : 1, width: isColumn ? "100%" : "auto", minWidth: "120px", marginLeft: isColumn ? "0 !important" : undefined }}
                >
                    {confirmText}
                </MKButton>

            </DialogActions>
        </Dialog>
    );
}

ModalComponent.defaultProps = {
    variant: "confirm",
    title: "",
    confirmText: "ตกลง",
    hideCancel: false,
    isConfirmDisabled: false,
};

ModalComponent.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    content: PropTypes.node.isRequired,
    title: PropTypes.node,
    variant: PropTypes.oneOf(["confirm", "success", "warning", "error"]),
    confirmColor: PropTypes.string,
    isConfirmDisabled: PropTypes.bool,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    cancelColor: PropTypes.string,
    hideCancel: PropTypes.bool,
    buttonDirection: PropTypes.oneOf(["row", "column"])
};

export default ModalComponent;