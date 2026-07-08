"use client";

export function ConfirmDeleteButton({
  formAction,
  children,
}: {
  formAction: (formData: FormData) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      formAction={formAction}
      onClick={(e) => {
        if (!confirm("¿Eliminar este recurso? Esta acción no se puede deshacer.")) {
          e.preventDefault();
        }
      }}
      className="btn btn-ghost btn-sm text-danger"
    >
      {children}
    </button>
  );
}
