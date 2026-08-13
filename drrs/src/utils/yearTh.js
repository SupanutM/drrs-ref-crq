import dayjs from "dayjs";
import "dayjs/locale/th";
dayjs.locale("th");

export const range = (startVal = 0, endVal = 0, increment = 0) => {
  let list = [];
  if (increment <= 0) {
    return list;
  }
  for (let index = startVal; index <= endVal; index = index + increment) {
    list = [...list, index];
  }
  return list;
};

const yearBoundary = 99;
const thisYear = dayjs().year() + 543;
const minYear = thisYear - yearBoundary;
const maxYear = thisYear;

export const yearTh = range(minYear, maxYear, 1);
export default yearTh;
