"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import dayjs from "dayjs";
import { DatePicker, PickerDay } from "@mui/x-date-pickers";

function StyledDay(
  props: React.ComponentProps<typeof PickerDay> & { availableSet?: Set<string> },
) {
  const { availableSet, day, ...other } = props;

  // Sin lista de disponibilidad (p. ej. formulario de Cierres): día normal, sin
  // punto de color y sin deshabilitar.
  if (!availableSet) {
    return <PickerDay {...other} day={day} />;
  }

  const key = day.format("YYYY-MM-DD");
  const available = availableSet.has(key);

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
  autoSubmit,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  required?: boolean;
  label?: string;
  availableDates?: string[];
  /** Navega solo al elegir fecha, sin botón de "Ver". */
  autoSubmit?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  // El campo vive en una ruta que solo cambia sus searchParams (flechas de día
  // anterior/siguiente, "Hoy"): React no lo remonta, así que hay que re-sincronizar
  // el estado cuando el servidor manda otra fecha. Ajustar estado en render es el
  // patrón que React recomienda para esto (más barato que un efecto: no repinta dos veces).
  const [lastDefault, setLastDefault] = useState(defaultValue);
  if (defaultValue !== lastDefault) {
    setLastDefault(defaultValue);
    setValue(defaultValue ?? "");
  }
  const hiddenRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Solo se restringe/colorea por disponibilidad cuando el que usa el campo pasa
  // una lista (widget de reservas). Sin lista (Cierres) se puede elegir cualquier día.
  const hasAvailability = availableDates !== undefined;
  const availableSet = useMemo(() => new Set(availableDates ?? []), [availableDates]);

  function handleChange(v: dayjs.Dayjs | null) {
    const next = v ? v.format("YYYY-MM-DD") : "";
    setValue(next);
    if (!autoSubmit || !next) return;

    // Se recogen los demás campos del formulario (personas, etc.) para no
    // perderlos, y se navega en cliente: mismo resultado que pulsar "Ver".
    const form = hiddenRef.current?.form;
    const params = new URLSearchParams();
    if (form) {
      for (const [key, val] of new FormData(form).entries()) {
        if (typeof val === "string" && val) params.set(key, val);
      }
    }
    params.set(name, next);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <>
      <input ref={hiddenRef} type="hidden" name={name} value={value} />
      <DatePicker
        label={label}
        value={value ? dayjs(value) : null}
        onChange={handleChange}
        minDate={min ? dayjs(min) : undefined}
        shouldDisableDate={
          hasAvailability ? (date) => !availableSet.has(date.format("YYYY-MM-DD")) : undefined
        }
        slots={{ day: StyledDay }}
        slotProps={{
          day: { availableSet: hasAvailability ? availableSet : undefined } as any,
          textField: {
            required,
            disabled: pending,
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
