"use client";

import { type ReactNode } from "react";

export function ConfirmForm({
  message,
  action,
  children,
  className,
}: {
  message: string;
  action: (formData: FormData) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
