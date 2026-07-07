"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown in the root layout itself. Must render
// its own <html>/<body> because it replaces the entire document.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          background: "#fbfaf6",
          color: "#1c1917",
        }}
      >
        <div style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ marginTop: "0.5rem", color: "#78716c" }}>
            Ha ocurrido un error inesperado. Vuelve a intentarlo en un momento.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: 0,
              background: "#f59e0b",
              color: "#1c1917",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
