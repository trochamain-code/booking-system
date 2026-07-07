"use client";

import { useEffect } from "react";

// Segment error boundary: catches errors thrown while rendering any route so the
// user sees a recoverable page instead of a blank screen or a raw stack trace.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted">
          Ha ocurrido un error inesperado. Vuelve a intentarlo en un momento.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-subtle">Ref: {error.digest}</p>
        )}
        <button onClick={reset} className="btn btn-primary mt-6">
          Reintentar
        </button>
      </div>
    </main>
  );
}
