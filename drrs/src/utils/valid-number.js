import validator from "validator";

export function validNumber(value) {
  return !validator.isNumeric(value) ? true : false;
}

export default validNumber;
