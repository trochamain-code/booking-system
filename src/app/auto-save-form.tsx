"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/app/submit-button";

/**
 * Form that submits its server action automatically when any field changes.
 * Listens to the native `change` event (fires on blur for text/number inputs,
 * immediately for selects/checkboxes/time pickers), so it doesn't fire per
 * keystroke. requestSubmit() runs HTML validation, so invalid rows don't save.
 */
export function AutoSaveForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    // Debounced: time pickers fire `change` per segment (hour, then minutes)
    // and number spinners per click — wait for the value to settle.
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => form.requestSubmit(), 700);
    };
    form.addEventListener("change", handler);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("change", handler);
    };
  }, []);
  return (
    <form ref={ref} action={action} className={className}>
      {children}
    </form>
  );
}

/** Shows a spinner + "Guardando…" while the surrounding AutoSaveForm is in flight. */
export function SavingIndicator({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs text-subtle ${className ?? ""}`}>
      {pending && <Spinner className="h-3.5 w-3.5 animate-spin" />}
      {pending ? "Guardando…" : ""}
    </span>
  );
}
