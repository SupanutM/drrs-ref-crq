/* eslint-disable */
import React, { useState, useEffect, forwardRef } from "react";
import DatePicker, { registerLocale, setDefaultLocale } from "react-datepicker";
import { Box, Button, FormControl, NativeSelect } from "@mui/material";
import MKInput from "components/MKInput";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import "react-datepicker/dist/react-datepicker.css";
import "assets/css/globals.css";

import dayjs from "dayjs";
import th from "date-fns/locale/th";
import "dayjs/locale/th";
dayjs.locale("th");

registerLocale("th", th);
setDefaultLocale("th");

const months = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const CustomInput = ({
  value,
  onClick,
  placeholderName,
  label,
  displayFormat,
  disabled,
  readOnly,
  style,
  error,
  success,
  color = "primary",
}) => {
  let thaiDate = "";
  if (value !== "" && value !== null && value !== undefined) {
    let date = dayjs(value);
    if (!date.isValid() && typeof value === "string") {
      const mmYyyyMatch = value.match(/^(\d{2})[\/-](\d{4})$/);
      const yyyyMmMatch = value.match(/^(\d{4})[\/-](\d{2})$/);
      if (mmYyyyMatch) {
        date = dayjs(`${mmYyyyMatch[2]}-${mmYyyyMatch[1]}-01`);
      } else if (yyyyMmMatch) {
        date = dayjs(`${yyyyMmMatch[1]}-${yyyyMmMatch[2]}-01`);
      }
    }
    if (date.isValid()) {
      const thaiYear = date.year() > 2400 ? date.year() : date.year() + 543;
      const wrappedDisplayFormat = displayFormat
        ? displayFormat.replace(/YYYY/, thaiYear).replace(/YY/, thaiYear % 100)
        : null;
      thaiDate =
        (wrappedDisplayFormat && `${date.format(wrappedDisplayFormat)}`) ||
        `${thaiYear}${date.format("-MM-DD")}`;
    }
  }
  return (
    <MKInput
      value={thaiDate}
      onClick={onClick}
      label={label || placeholderName}
      placeholder={placeholderName}
      disabled={disabled}
      readOnly={readOnly}
      style={style}
      error={error}
      success={success}
      color={color}
      variant="outlined"
      fullWidth
      inputProps={{ readOnly: true }}
    />
  );
};

const CustomInputWrapper = forwardRef(({ ...props }, ref) => (
  <div ref={ref} style={{ width: "100%" }}>
    <CustomInput {...props} />
  </div>
));

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

export const DatePickerCustoms = (props) => {
  const parseToChristDate = (val) => {
    if (!val) return null;
    let d = dayjs(val);
    if (!d.isValid() && typeof val === "string") {
      const mmYyyyMatch = val.match(/^(\d{2})[\/-](\d{4})$/);
      const yyyyMmMatch = val.match(/^(\d{4})[\/-](\d{2})$/);
      if (mmYyyyMatch) {
        d = dayjs(`${mmYyyyMatch[2]}-${mmYyyyMatch[1]}-01`);
      } else if (yyyyMmMatch) {
        d = dayjs(`${yyyyMmMatch[1]}-${yyyyMmMatch[2]}-01`);
      }
    }
    if (!d.isValid()) return null;
    if (d.year() > 2400) {
      return d.subtract(543, "year").toDate();
    }
    return d.toDate();
  };

  const [value, setValue] = useState(props.value ? props.value : null);
  const [selectedDate, setSelectedDate] = useState(parseToChristDate(props.value));

  useEffect(() => {
    setValue(props.value ? props.value : null);
    setSelectedDate(parseToChristDate(props.value));
  }, [props.value]);

  const yearBoundary = props.yearBoundary ?? 99;
  const thisYear = dayjs().year();
  const minYear = props.minDate ? dayjs(props.minDate).year() : thisYear - yearBoundary;
  const maxYear = props.maxDate ? dayjs(props.maxDate).year() : thisYear + yearBoundary;
  const years = range(minYear, maxYear, 1);
  const highlightWithRanges = [
    {
      "react-datepicker__day--highlighted-today": [new Date()],
    },
  ];
  return (
    <DatePicker
      locale="th"
      withPortal
      peekNextMonth
      showMonthDropdown
      showYearDropdown
      scrollableYearDropdown
      todayButton={props.showTodayButton ? "วันนี้" : undefined}
      renderCustomHeader={({
        date,
        changeYear,
        changeMonth,
        decreaseMonth,
        increaseMonth,
        decreaseYear,
        increaseYear,
        prevMonthButtonDisabled,
        nextMonthButtonDisabled,
        prevYearButtonDisabled,
        nextYearButtonDisabled,
      }) => (
        <Box
          sx={{
            margin: 2,
            justifyContent: "space-between",
          }}
          display="flex"
        >
          <Button color={"secondary"} onClick={props.showMonthYearPicker || props.showYearPicker ? decreaseYear : decreaseMonth} disabled={props.showMonthYearPicker || props.showYearPicker ? prevYearButtonDisabled : prevMonthButtonDisabled}>
            <ArrowBackIosIcon />
          </Button>
          {!props.showMonthYearPicker && !props.showYearPicker && (
            <FormControl sx={{ m: 1 }} variant="filled">
              <NativeSelect
                color="secondary"
                size="small"
                value={months[dayjs(date).month()]}
                onChange={({ target: { value } }) => changeMonth(months.indexOf(value))}
              >
                {months.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </FormControl>
          )}
          <FormControl sx={{ m: 1 }} variant="standard">
            <NativeSelect
              color="secondary"
              size="small"
              value={dayjs(date).year()}
              onChange={({ target: { value } }) => changeYear(value)}
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option + 543}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <Button color={"secondary"} onClick={props.showMonthYearPicker || props.showYearPicker ? increaseYear : increaseMonth} disabled={props.showMonthYearPicker || props.showYearPicker ? nextYearButtonDisabled : nextMonthButtonDisabled}>
            <ArrowForwardIosIcon />
          </Button>
        </Box>
      )}
      minDate={props.minDate ? new Date(props.minDate) : null}
      maxDate={props.maxDate ? new Date(props.maxDate) : null}
      dateFormat={props.dateFormat ? props.dateFormat : (props.showYearPicker ? "yyyy" : props.showMonthYearPicker ? "MM/yyyy" : "yyyy-MM-dd")}
      selected={selectedDate}
      isClearable={!(props.disabled || props.readOnly) && (props.clearable ?? true)}
      disabled={props.disabled}
      readOnly={props.readOnly}
      showYearPicker={props.showYearPicker}
      showMonthYearPicker={props.showMonthYearPicker}
      renderYearContent={(year) => Number(year) + 543}
      onChange={(date) => {
        setSelectedDate(date);
        const dayjsObj = dayjs(date).isValid() ? dayjs(date) : null;
        let formatStr = "YYYY-MM-DD";
        if (props.showYearPicker) formatStr = "YYYY";
        else if (props.showMonthYearPicker) formatStr = "YYYY-MM";

        setValue(dayjsObj ? dayjsObj.format(formatStr) : "");
        let thaiDate = "";
        if (dayjsObj) {
          const thaiYear = dayjsObj.year() > 2400 ? dayjsObj.year() : dayjsObj.year() + 543;
          if (props.showYearPicker) thaiDate = `${thaiYear}`;
          else if (props.showMonthYearPicker) thaiDate = `${thaiYear}-${dayjsObj.format("MM")}`;
          else thaiDate = `${thaiYear}${dayjsObj.format("-MM-DD")}`;
        }
        const christDateStr = dayjsObj ? (dayjsObj.year() > 2400 ? dayjsObj.subtract(543, "year").format(formatStr) : dayjsObj.format(formatStr)) : "";
        props.onChange(christDateStr, thaiDate);
      }}
      highlightDates={highlightWithRanges}
      customInput={
        <CustomInputWrapper
          placeholderName={props.placeholder}
          label={props.label || props.placeholder}
          displayFormat={props.displayFormat}
          style={props.inputStyle}
          disabled={props.disabled}
          readOnly={props.readOnly}
          error={props.error}
          success={props.success}
          color={props.color || "primary"}
        />
      }
      {...props.reactDatePickerProps}
    />
  );
};
