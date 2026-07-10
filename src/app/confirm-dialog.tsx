"use client";

import { useCallback, useRef } from "react";

export function ConfirmDialog({
  message,
  onConfirm,
  children,
}: {
  message: string;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const handleClick = useCallback(() => {
    ref.current?.showModal();
  }, []);

  const handleConfirm = useCallback(() => {
    ref.current?.close();
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    ref.current?.close();
  }, []);

  return (
    <>
      <span onClick={handleClick} className="contents cursor-pointer">
        {children}
      </span>
      <dialog
        ref={ref}
        className="w-[90vw] max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl backdrop:bg-black/40 open:flex open:flex-col open:gap-4"
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", margin: 0 }}
        onClick={(e) => { if (e.target === ref.current) handleCancel(); }}
      >
        <p className="text-sm text-ink">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={handleCancel} className="btn btn-ghost btn-sm">
            Cancelar
          </button>
          <button onClick={handleConfirm} className="btn btn-danger btn-sm">
            Eliminar
          </button>
        </div>
      </dialog>
    </>
  );
}
