"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CopyButton } from "@/components/ui/CopyButton";
import { useTranslation } from "@/lib/i18n/useTranslation";

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-zinc-200 text-sm font-medium mb-1">{title}</p>
        <div className="text-zinc-400 text-sm space-y-1">{children}</div>
      </div>
    </div>
  );
}

export function OverlayGuide() {
  const { t } = useTranslation();
  const [port, setPort] = useState(9898);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    invoke<number>("get_overlay_port")
      .then(setPort)
      .catch(() => {});
  }, []);

  const overlayUrl = `http://localhost:${port}`;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🎬</span>
          <span className="text-white font-semibold text-sm">{t("overlayGuide.titulo")}</span>
        </div>
        <span className="text-zinc-500 text-xs">
          {open ? t("overlayGuide.fechar") : t("overlayGuide.verInstrucoes")}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-zinc-800 pt-4">
          {/* URL destaque */}
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-400 text-xs mb-2">{t("overlayGuide.enderecoLabel")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-indigo-300 font-mono text-sm select-all bg-zinc-900 px-3 py-2 rounded-md truncate">
                {overlayUrl}
              </code>
              <CopyButton text={overlayUrl} />
            </div>
          </div>

          {/* Passos */}
          <div className="space-y-4">
            <Step number={1} title={t("overlayGuide.step1Titulo")}>
              <p>{t("overlayGuide.step1Corpo")}</p>
            </Step>

            <Step number={2} title={t("overlayGuide.step2Titulo")}>
              <p>{t("overlayGuide.step2Corpo")}</p>
            </Step>

            <Step number={3} title={t("overlayGuide.step3Titulo")}>
              <p>{t("overlayGuide.step3Corpo")}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="text-indigo-300 font-mono text-xs bg-zinc-900 px-2 py-1 rounded">
                  {overlayUrl}
                </code>
                <CopyButton text={overlayUrl} />
              </div>
            </Step>

            <Step number={4} title={t("overlayGuide.step4Titulo")}>
              <p>{t("overlayGuide.step4Largura", { largura: 700 })}</p>
              <p className="mt-1">{t("overlayGuide.step4Altura", { min: 320, max: 650 })}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{t("overlayGuide.step4Dica")}</p>
            </Step>

            <Step number={5} title={t("overlayGuide.step5Titulo")}>
              <p>{t("overlayGuide.step5Corpo")}</p>
            </Step>

            <Step number={6} title={t("overlayGuide.step6Titulo")}>
              <p>{t("overlayGuide.step6Corpo")}</p>
            </Step>
          </div>

          {/* Dicas */}
          <div className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
            <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">
              {t("overlayGuide.dicasTitulo")}
            </p>
            <ul className="text-zinc-400 text-xs space-y-1.5 list-none">
              <li>✅ {t("overlayGuide.dica1")}</li>
              <li>✅ {t("overlayGuide.dica2")}</li>
              <li>
                ✅ {t("overlayGuide.dica3Prefixo")}{" "}
                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  {overlayUrl}
                </a>{" "}
                {t("overlayGuide.dica3Sufixo")}
              </li>
              <li>
                ⚠️ {t("overlayGuide.dica4Prefixo")} <strong className="text-zinc-300">{port}</strong>{" "}
                {t("overlayGuide.dica4Sufixo")}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
