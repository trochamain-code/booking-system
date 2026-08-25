"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput, { isPossiblePhoneNumber, type Country, type Value } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import es from "react-phone-number-input/locale/es.json";
import "react-phone-number-input/style.css";

/**
 * Teléfono con selector de país (bandera + prefijo) sobre react-phone-number-input.
 *
 * El formulario sigue enviando un único campo `phone`, así que las server actions
 * y /api/public/bookings no cambian: lo que viaja es el número ya normalizado a
 * E.164 ("+34612345678"), que es además lo que espera el enlace tel: del panel.
 *
 * Las banderas se importan del paquete (SVG en el bundle) en vez de dejar que la
 * librería las pida a su CDN por defecto: el widget se embebe en webs de terceros
 * y no debe depender de un dominio externo ni filtrar visitas a él.
 */
export function PhoneField({
  id,
  name = "phone",
  required,
  defaultValue,
  defaultCountry = "ES",
  autoComplete = "tel",
}: {
  id?: string;
  name?: string;
  required?: boolean;
  defaultValue?: string;
  /** País preseleccionado al abrir el formulario. */
  defaultCountry?: Country;
  autoComplete?: string;
}) {
  const [value, setValue] = useState<Value | undefined>((defaultValue as Value) || undefined);
  const [touched, setTouched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // `value` es undefined mientras solo haya prefijo: con el campo vacío la
  // librería no devuelve nada aunque el <input> muestre "+34".
  const empty = !value;
  const error = empty
    ? required
      ? "Introduce un teléfono de contacto."
      : ""
    : isPossiblePhoneNumber(value)
      ? ""
      : "Ese número no parece válido para el país elegido.";

  // El <input> visible nunca está vacío (lleva el prefijo dentro), así que el
  // `required` del navegador no llegaría a saltar. Se traslada el estado real
  // del número a la validación nativa para que el submit se bloquee igual y con
  // un mensaje en español, en lugar de viajar al servidor para que lo rechace.
  useEffect(() => {
    const input = wrapperRef.current?.querySelector<HTMLInputElement>("input.PhoneInputInput");
    input?.setCustomValidity(error);
  }, [error]);

  const showError = touched && Boolean(error);

  return (
    <div className="phone-field" ref={wrapperRef}>
      <input type="hidden" name={name} value={value ?? ""} />
      <PhoneInput
        id={id}
        international
        flags={flags}
        labels={es}
        defaultCountry={defaultCountry}
        countryCallingCodeEditable={false}
        value={value}
        onChange={setValue}
        onBlur={() => setTouched(true)}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={showError || undefined}
        aria-describedby={showError && id ? `${id}-error` : undefined}
      />
      {showError && (
        <p id={id ? `${id}-error` : undefined} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
