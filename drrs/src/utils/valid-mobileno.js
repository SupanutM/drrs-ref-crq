import validator from "validator";

export function validMobileNo(value) {
  return !validator.isMobilePhone(value, "th-TH") ? true : false;
}

export default validMobileNo;
