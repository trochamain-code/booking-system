"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/app/icons";

export function PasswordField({
  id,
  name,
  required,
  minLength,
  placeholder,
  className = "input",
}: {
  id: string;
  name: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        className={className + " pr-10"}
      />
      <button
        type="button"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
