import dayjs from "dayjs";
export function validDate(value, format) {
  return dayjs(value, format).format(format) === value ? false : true;
}

export default validDate;
