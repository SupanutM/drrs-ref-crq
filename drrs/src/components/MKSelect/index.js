import { forwardRef } from "react";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Custom styles for MKInput
import MKSelectRoot from "components/MKSelect/MKSelectRoot";

const MKSelect = forwardRef(({ error, success, disabled, ...rest }, ref) => (
  <MKSelectRoot {...rest} ref={ref} ownerState={{ error, success, disabled }} />
));

// Setting default values for the props of MKInput
MKSelect.defaultProps = {
  error: false,
  success: false,
  disabled: false,
};

// Typechecking props for the MKInput
MKSelect.propTypes = {
  error: PropTypes.bool,
  success: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default MKSelect;
