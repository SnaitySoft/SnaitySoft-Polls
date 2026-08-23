"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({
  text,
  className,
  iconOnly,
}: {
  text: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copiado!" : "Copiar"}
      className={
        className ??
        "shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
      }
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {!iconOnly && (copied ? "Copiado!" : "Copiar")}
    </button>
  );
}
