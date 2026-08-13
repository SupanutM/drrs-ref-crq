import validator from "validator";

export function validCharater(value) {
  return !validator.isAlpha(value, "th-TH") ? true : false;
}

export default validCharater;
