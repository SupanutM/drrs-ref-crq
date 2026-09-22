import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Fade from "@mui/material/Fade";

import MKBox from "components/MKBox";
import MKTypography from "components/MKTypography";
import MKInput from "components/MKInput";
import MKButton from "components/MKButton";
import MKAlert from "components/MKAlert";

function AdminLoginView({ state, handlers, secretRef }) {
  const { username, isAlert, alertMsg, alertType, isLoading } = state;
  const { handleChangeUsername, handleSubmit, handleKeyDown } = handlers;

  return (
    <Grid container justifyContent="center">
      <Grid item xs={12} sm={8} md={5}>
        <MKBox mb={3} textAlign="center">
          <MKTypography variant="h4" fontWeight="bold" color="dark">
            เข้าสู่ระบบ Backoffice (admin)
          </MKTypography>
          {/* <MKTypography variant="body2" color="text" mt={1}>
            เข้าสู่ระบบด้วยบัญชี Active Directory (AD) ขององค์กร
          </MKTypography> */}
        </MKBox>

        {isAlert && (
          <Fade in={isAlert}>
            <MKBox mb={2}>
              <MKAlert color={alertType} dismissible>
                {alertMsg}
              </MKAlert>
            </MKBox>
          </Fade>
        )}

        <MKBox mb={2}>
          <MKInput
            type="text"
            label="Username"
            fullWidth
            value={username}
            onChange={handleChangeUsername}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="username"
          />
        </MKBox>

        <MKBox mb={3}>
          {/* uncontrolled input โดยเจตนา — อ่านค่าผ่าน secretRef ตอน submit เท่านั้น */}
          <MKInput
            type="password"
            label="Password"
            fullWidth
            inputRef={secretRef}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </MKBox>

        <MKBox>
          <MKButton
            variant="gradient"
            color="primary"
            fullWidth
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </MKButton>
        </MKBox>
      </Grid>
    </Grid>
  );
}

AdminLoginView.propTypes = {
  state: PropTypes.shape({
    username: PropTypes.string,
    isAlert: PropTypes.bool,
    alertMsg: PropTypes.string,
    alertType: PropTypes.string,
    isLoading: PropTypes.bool,
  }).isRequired,
  handlers: PropTypes.shape({
    handleChangeUsername: PropTypes.func.isRequired,
    handleSubmit: PropTypes.func.isRequired,
    handleKeyDown: PropTypes.func.isRequired,
  }).isRequired,
  secretRef: PropTypes.shape({
    // eslint-disable-next-line react/forbid-prop-types
    current: PropTypes.any,
  }).isRequired,
};

export default AdminLoginView;
