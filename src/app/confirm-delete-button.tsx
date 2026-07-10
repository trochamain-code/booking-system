"use client";

import { useRef } from "react";
import { ConfirmDialog } from "./confirm-dialog";

export function ConfirmDeleteButton({
  formAction,
  id,
  fields,
  children,
}: {
  formAction: (formData: FormData) => void;
  id: string;
  fields?: Record<string, string>;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef}>
      <input type="hidden" name="id" value={id} />
      {fields && Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <ConfirmDialog
        message="¿Eliminar este recurso? Esta acción no se puede deshacer."
        onConfirm={() => {
          const form = formRef.current;
          if (!form) return;
          const fd = new FormData(form);
          formAction(fd);
        }}
      >
        <button type="button" className="btn btn-ghost btn-sm text-danger">
          {children}
        </button>
      </ConfirmDialog>
    </form>
  );
}
