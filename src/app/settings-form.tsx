"use client";

import { useActionState, useEffect } from "react";
import { updateBranding } from "@/lib/company-actions";
import toast from "react-hot-toast";

const initialState: { ok: boolean; error?: string } = { ok: true };

export function SettingsForm({ children }: { children: React.ReactNode }) {
  const [state, formAction] = useActionState(updateBranding, initialState);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Cambios guardados");
    else toast.error(state.error ?? "Error al guardar");
  }, [state]);

  return (
    <form action={formAction} data-tour="branding" className="card space-y-5 p-6">
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {children}
    </form>
  );
}
