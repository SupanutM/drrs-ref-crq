import validator from "validator";

export function validIdCard(value) {
  return !validator.isIdentityCard(value, "TH") ? true : false;
}

export default validIdCard;
