"use client";

import { useFormStatus } from "react-dom";

/** Spinning circle used for pending states across the app. */
export function Spinner({ className = "h-4 w-4 animate-spin" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Submit button that shows a spinner and disables itself while the surrounding
 * form's server action is in flight. Must render inside the <form> it submits
 * (useFormStatus reads the nearest form's pending state).
 */
export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
