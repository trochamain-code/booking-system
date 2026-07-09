"use client";

/**
 * Unified switch control. Renders a hidden checkbox + a token-styled track/knob
 * (peer-checked CSS, no hardcoded colors). Use inside a <form>:
 *  - submitOnChange: submit the form immediately when toggled (e.g. Stripe on/off).
 *  - name: sent as "on"/absent so server actions reading `=== "on"` keep working.
 */
export function Toggle({
  name,
  defaultChecked,
  label,
  submitOnChange,
}: {
  name?: string;
  defaultChecked?: boolean;
  label: string;
  submitOnChange?: boolean;
}) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-label={label}
        className="peer sr-only"
        onChange={(e) => {
          if (submitOnChange) e.currentTarget.form?.requestSubmit();
        }}
      />
      <span
        className="h-6 w-11 rounded-full border border-border-strong bg-surface-2 transition-colors duration-200 peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-hover after:absolute after:left-0.5 after:top-1/2 after:h-5 after:w-5 after:-translate-y-1/2 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:after:translate-x-full"
      />
    </label>
  );
}
