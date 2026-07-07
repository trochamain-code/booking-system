"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

export function DatePickerField({
  name,
  defaultValue,
  min,
  required,
  label,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  required?: boolean;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <DatePicker
        label={label}
        value={value ? dayjs(value) : null}
        onChange={(v) => setValue(v ? v.format("YYYY-MM-DD") : "")}
        minDate={min ? dayjs(min) : undefined}
        slotProps={{
          textField: {
            required,
            size: "small",
            variant: "outlined",
            sx: {
              width: "100%",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                backgroundColor: "var(--color-surface)",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--color-border)",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "var(--color-border-strong)",
              },
              "& .MuiInputLabel-root": {
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
                color: "var(--color-muted)",
              },
              "& .MuiSvgIcon-root": {
                color: "var(--color-muted)",
              },
            },
          },
        }}
      />
    </>
  );
}
