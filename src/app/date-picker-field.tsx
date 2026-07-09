"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { DatePicker, PickerDay } from "@mui/x-date-pickers";

function StyledDay(
  props: React.ComponentProps<typeof PickerDay> & { availableSet?: Set<string> },
) {
  const { availableSet, day, ...other } = props;
  const key = day.format("YYYY-MM-DD");
  const available = availableSet?.has(key);

  return (
    <PickerDay
      {...other}
      day={day}
      sx={{
        ...(available
          ? {
              "&::after": {
                content: '""',
                display: "block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: "var(--color-success, #16a34a)",
                position: "absolute",
                bottom: 2,
              },
            }
          : {
              "&::after": {
                content: '""',
                display: "block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: "var(--color-danger, #dc2626)",
                position: "absolute",
                bottom: 2,
              },
            }),
      }}
    />
  );
}

export function DatePickerField({
  name,
  defaultValue,
  min,
  required,
  label,
  availableDates,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  required?: boolean;
  label?: string;
  availableDates?: string[];
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const availableSet = useMemo(() => new Set(availableDates ?? []), [availableDates]);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <DatePicker
        label={label}
        value={value ? dayjs(value) : null}
        onChange={(v) => setValue(v ? v.format("YYYY-MM-DD") : "")}
        minDate={min ? dayjs(min) : undefined}
        shouldDisableDate={(date) => !availableSet.has(date.format("YYYY-MM-DD"))}
        slots={{ day: StyledDay }}
        slotProps={{
          day: { availableSet } as any,
          textField: {
            required,
            size: "small",
            variant: "outlined",
            // Borders/font/radius now come from the app-wide MUI theme in
            // mui-provider.tsx; only field-local concerns stay here.
            sx: {
              width: "100%",
              // 16px on mobile so iOS Safari doesn't auto-zoom on focus.
              "& .MuiOutlinedInput-root": { fontSize: { xs: "1rem", sm: "0.875rem" } },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--color-border-strong)" },
              "& .MuiSvgIcon-root": { color: "var(--color-muted)" },
            },
          },
        }}
      />
    </>
  );
}
