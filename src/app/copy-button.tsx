"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/app/icons";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={`btn btn-ghost btn-sm ${copied ? "text-success" : ""}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </button>
  );
}
