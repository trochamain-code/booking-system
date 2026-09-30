"use client";

import { translator, type BookingLanguage } from "@/lib/booking-locale";
import { useState } from "react";

const INVALID_NAME_CHARACTERS = /[^\p{L}\s'’-]/gu;

type NameFieldProps = {
  language?: BookingLanguage;
  id: string;
  name: string;
  autoComplete?: string;
  className?: string;
};

/** Name input that removes digits and other unsupported characters as they are typed. */
export function NameField({ id, name, autoComplete, className, language = "es" }: NameFieldProps) {
  const [value, setValue] = useState("");

  return (
    <input
      id={id}
      name={name}
      value={value}
      onChange={(event) => setValue(event.target.value.replace(INVALID_NAME_CHARACTERS, ""))}
      required
      minLength={3}
      maxLength={120}
      pattern="[\\p{L}]+(?:[\\s'’-]+[\\p{L}]+)*"
      title={translator(language)("nameInvalid")}
      autoComplete={autoComplete}
      className={className}
    />
  );
}
