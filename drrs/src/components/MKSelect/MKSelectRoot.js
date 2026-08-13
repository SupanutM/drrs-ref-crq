// @mui material components
import { styled } from "@mui/material/styles";
import Select from "@mui/material/Select";

export default styled(Select)(({ theme, ownerState }) => {
  const { palette } = theme;
  const { error, success, disabled } = ownerState;

  const { grey, transparent, error: colorError, success: colorSuccess } = palette;

  // styles for the input with error={true}
  const errorStyles = () => ({
    "& .Mui-focused": {
      "& .MuiOutlinedInput-notchedOutline, &:after": {
        borderColor: colorError.main,
      },
    },
    "& .MuiSelect-select::-webkit-input-placeholder": {
      color: colorError.main,
      opacity: "1",
    },
  });

  // styles for the input with success={true}
  const successStyles = () => ({
    "& .Mui-focused": {
      "& .MuiOutlinedInput-notchedOutline, &:after": {
        borderColor: colorSuccess.main,
      },
    },
    "& .MuiSelect-select::-webkit-input-placeholder": {
      color: colorSuccess.main,
      opacity: "1",
    },
  });
  return {
    backgroundColor: disabled ? `${grey[200]} !important` : transparent.main,
    pointerEvents: disabled ? "none" : "auto",
    ...(error && errorStyles()),
    ...(success && successStyles()),
  };
});
