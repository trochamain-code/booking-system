"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UploadLogoResult } from "@/lib/upload-actions";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

export function LogoUploader({
  logoUrl,
  companyName,
  action,
  companyId,
}: {
  logoUrl: string | null;
  companyName: string;
  // Server action passed in by the page: own-company upload in the dashboard,
  // any-company upload in the admin panel.
  action: (formData: FormData) => Promise<UploadLogoResult>;
  companyId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File | undefined) {
    if (!file || pending) return;
    setMessage(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setMessage({ kind: "error", text: "Formato no admitido. Usa PNG, JPG o WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ kind: "error", text: "La imagen supera los 2 MB." });
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    const fd = new FormData();
    fd.set("file", file);
    if (companyId) fd.set("companyId", companyId);
    startTransition(async () => {
      // A dropped connection (redeploy, tunnel blip) must show a retry message,
      // not bubble out of the transition and take down the page's error boundary.
      let result: UploadLogoResult;
      try {
        result = await action(fd);
      } catch {
        result = { ok: false, error: "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo." };
      }
      if (result.ok) {
        setMessage({ kind: "ok", text: "Logo actualizado. Se usará en el widget y en los correos." });
        router.refresh();
      } else {
        setPreview(null);
        URL.revokeObjectURL(localUrl);
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  const shown = preview ?? logoUrl;

  return (
    <div>
      <span className="label">Logo</span>
      <div
        role="button"
        tabIndex={0}
        aria-label="Subir logo: arrastra una imagen o pulsa para elegirla"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition ${
          dragOver ? "border-primary bg-warn-bg" : "border-border hover:border-border-strong"
        } ${pending ? "opacity-60" : ""}`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={`Logo de ${companyName}`} className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-subtle" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5-9 9" />
            </svg>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {pending ? "Subiendo…" : "Arrastra tu logo aquí o haz clic para elegirlo"}
          </p>
          <p className="mt-0.5 text-xs text-muted">PNG, JPG o WebP · máximo 2 MB · se guarda al instante</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-2 rounded-xl px-3 py-2 text-sm ${
            message.kind === "error" ? "bg-danger-bg text-danger" : "bg-success-bg text-success"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
