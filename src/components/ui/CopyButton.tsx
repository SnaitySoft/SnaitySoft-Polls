"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function CopyButton({
  text,
  className,
  iconOnly,
}: {
  text: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const label = copied ? t("copyButton.copiado") : t("copyButton.copiar");

  return (
    <button
      onClick={handleCopy}
      title={label}
      className={
        className ??
        "shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
      }
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {!iconOnly && label}
    </button>
  );
}
