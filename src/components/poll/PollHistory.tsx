"use client";

import { useState } from "react";
import { History, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PollResult, VotePlatform } from "@/lib/poll/types";
import { VOTE_PLATFORMS, PLATFORM_BAR_COLOR, PLATFORM_LABEL } from "@/lib/poll/platformColors";

function formatDate(ts: number, locale: "pt" | "en") {
  return new Date(ts).toLocaleString(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(ts: number, locale: "pt" | "en") {
  return new Date(ts).toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function platformTotals(options: PollResult["poll"]["options"]): Record<VotePlatform, number> {
  const totals: Record<VotePlatform, number> = { twitch: 0, youtube: 0, kick: 0 };
  for (const opt of options) {
    for (const p of VOTE_PLATFORMS) {
      totals[p] += opt.votesByPlatform?.[p] ?? 0;
    }
  }
  return totals;
}

function HistoryEntryCard({
  entry,
  locale,
  t,
  onDelete,
}: {
  entry: PollResult;
  locale: "pt" | "en";
  t: ReturnType<typeof useTranslation>["t"];
  onDelete: () => void;
}) {
  const [showAudit, setShowAudit] = useState(false);
  const totals = platformTotals(entry.poll.options);
  const voteLog = entry.poll.voteLog ?? [];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-medium text-sm truncate">{entry.poll.question}</p>
          <p className="text-zinc-600 text-xs mt-0.5">{formatDate(entry.poll.startedAt, locale)}</p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors shrink-0"
          title={t("pollHistory.excluirTitle")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <p className="text-xs mt-2">
        <span className="text-zinc-500">{t("pollHistory.vencedora")}: </span>
        {entry.winner ? (
          <span className="text-indigo-300 font-medium">
            🏆 {entry.winner.label} ({entry.percentages[entry.winner.id] ?? 0}%)
          </span>
        ) : (
          <span className="text-zinc-500">{t("pollHistory.semVotos")}</span>
        )}
      </p>

      <div className="mt-3 space-y-2.5">
        {entry.poll.options.map((opt) => {
          const pct = entry.percentages[opt.id] ?? 0;
          const isWinner = entry.winner?.id === opt.id;
          return (
            <div key={opt.id}>
              <div className="flex justify-between gap-2 text-xs mb-1">
                <span
                  className={`min-w-0 break-words ${isWinner ? "text-indigo-300 font-medium" : "text-zinc-400"}`}
                >
                  {opt.label}
                  {isWinner && " 🏆"}
                </span>
                <span className="text-zinc-500 tabular-nums shrink-0">
                  {opt.votes} ({pct}%)
                </span>
              </div>
              <div
                className={`w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden ${
                  isWinner ? "ring-1 ring-indigo-400" : ""
                }`}
              >
                <div className="h-full flex" style={{ width: `${pct}%` }}>
                  {VOTE_PLATFORMS.map((p) => {
                    const v = opt.votesByPlatform?.[p] ?? 0;
                    if (v === 0) return null;
                    const segPct = opt.votes > 0 ? (v / opt.votes) * 100 : 0;
                    return (
                      <div key={p} className={`h-full ${PLATFORM_BAR_COLOR[p]}`} style={{ width: `${segPct}%` }} />
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 mt-1 text-[11px] text-zinc-500">
                {VOTE_PLATFORMS.map((p) => {
                  const v = opt.votesByPlatform?.[p] ?? 0;
                  if (v === 0) return null;
                  return (
                    <span key={p} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_BAR_COLOR[p]}`} />
                      {PLATFORM_LABEL[p]} {v}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-zinc-500 text-[11px] uppercase tracking-wide">{t("pollHistory.totalPorPlataforma")}</p>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {VOTE_PLATFORMS.map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${PLATFORM_BAR_COLOR[p]}`} />
              {PLATFORM_LABEL[p]} <span className="tabular-nums text-zinc-300">{totals[p]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {showAudit ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showAudit ? t("pollHistory.esconderVotos") : t("pollHistory.verVotos", { n: voteLog.length })}
        </button>
        <p className="text-zinc-600 text-xs">
          {entry.totalVotes} {t(entry.totalVotes !== 1 ? "common.votoPlural" : "common.votoSingular")}
        </p>
      </div>

      {showAudit && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-zinc-950/60 border border-zinc-800">
          {voteLog.length === 0 ? (
            <p className="text-zinc-600 text-xs p-3">{t("pollHistory.nenhumVotoRegistrado")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-zinc-500 text-left">
                  <th className="px-3 py-1.5 font-medium">{t("pollHistory.colHorario")}</th>
                  <th className="px-3 py-1.5 font-medium">{t("pollHistory.colUsuario")}</th>
                  <th className="px-3 py-1.5 font-medium">{t("pollHistory.colOpcao")}</th>
                </tr>
              </thead>
              <tbody>
                {voteLog.map((v, i) => {
                  const optLabel = entry.poll.options.find((o) => o.id === v.optionId)?.label ?? v.optionId;
                  return (
                    <tr key={`${v.userId}-${v.timestamp}-${i}`} className="border-t border-zinc-800/60">
                      <td className="px-3 py-1.5 text-zinc-500 tabular-nums whitespace-nowrap">
                        {formatTime(v.timestamp, locale)}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-300 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PLATFORM_BAR_COLOR[v.platform]}`} />
                          <span className="truncate">{v.username}</span>
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-zinc-400 min-w-0 truncate">{optLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export function PollHistory() {
  const { t, locale } = useTranslation();
  const { history, deleteHistoryEntry, clearHistory } = usePollStore();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-xl">{t("pollHistory.titulo")}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">{t("pollHistory.descricao")}</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            {t("pollHistory.limparTudo")}
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-10 border border-zinc-700 flex flex-col items-center justify-center text-center gap-2">
          <History size={32} className="text-zinc-700" />
          <p className="text-zinc-400 text-sm font-medium">{t("pollHistory.nenhumaPoll")}</p>
          <p className="text-zinc-600 text-xs">{t("pollHistory.resultadoApareceAqui")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <HistoryEntryCard
              key={entry.poll.id}
              entry={entry}
              locale={locale}
              t={t}
              onDelete={() => deleteHistoryEntry(entry.poll.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
