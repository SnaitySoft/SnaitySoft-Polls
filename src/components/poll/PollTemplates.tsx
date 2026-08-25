"use client";

import { ListChecks, Play, Trash2 } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { PollTemplate } from "@/lib/poll/types";
import { useTranslation } from "@/lib/i18n/useTranslation";

function formatDuration(sec: number) {
  if (sec >= 60) return `${Math.round(sec / 60)}min`;
  return `${sec}s`;
}

export function PollTemplates({ onUse }: { onUse: (template: PollTemplate) => void }) {
  const { t } = useTranslation();
  const { templates, deleteTemplate } = usePollStore();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-white font-semibold text-xl">{t("pollTemplates.titulo")}</h2>
        <p className="text-zinc-500 text-sm mt-0.5">{t("pollTemplates.descricao")}</p>
      </div>

      {templates.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-10 border border-zinc-700 flex flex-col items-center justify-center text-center gap-2">
          <ListChecks size={32} className="text-zinc-700" />
          <p className="text-zinc-400 text-sm font-medium">{t("pollTemplates.nenhumModelo")}</p>
          <p className="text-zinc-600 text-xs">{t("pollTemplates.comoSalvar")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-700 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate">{tpl.question}</p>
                <p className="text-zinc-500 text-xs mt-1 truncate">
                  {tpl.options.join(" · ")} — {formatDuration(tpl.durationSec)} —{" "}
                  {tpl.uniqueVotes ? t("pollTemplates.votosUnicos") : t("pollTemplates.votosMultiplos")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onUse(tpl)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  <Play size={13} />
                  {t("common.usar")}
                </button>
                <button
                  onClick={() => deleteTemplate(tpl.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  title={t("pollTemplates.excluirTitle")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
