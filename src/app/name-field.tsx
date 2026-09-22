"use client";

import { useState } from "react";

const INVALID_NAME_CHARACTERS = /[^\p{L}\s'’-]/gu;

type NameFieldProps = {
  id: string;
  name: string;
  autoComplete?: string;
  className?: string;
};

/** Name input that removes digits and other unsupported characters as they are typed. */
export function NameField({ id, name, autoComplete, className }: NameFieldProps) {
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
      title="Introduce un nombre de al menos 3 caracteres, sin números."
      autoComplete={autoComplete}
      className={className}
    />
  );
}
