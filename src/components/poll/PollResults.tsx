"use client";

import { BarChart3, Trash2 } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { PollOption } from "@/lib/poll/types";

function CardHeader() {
  return (
    <div className="flex items-center gap-2">
      <BarChart3 size={17} className="text-indigo-400" />
      <h2 className="text-white font-semibold text-sm">Prévia da Poll</h2>
    </div>
  );
}

export function PollResults() {
  const { poll, lastResult, clearCurrentPoll } = usePollStore();

  if (!poll && !lastResult) {
    return (
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
        <CardHeader />
        <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
          <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center">
            <BarChart3 size={26} className="text-indigo-500/70" />
          </div>
          <p className="text-zinc-300 text-sm font-medium">Nenhuma poll ativa</p>
          <p className="text-zinc-600 text-xs">A prévia da poll aparecerá aqui.</p>
        </div>
      </div>
    );
  }

  const displayPoll = poll ?? lastResult?.poll;
  const options: PollOption[] = (displayPoll?.options as PollOption[]) ?? [];
  const totalVotes = options.reduce((s, o) => s + o.votes, 0);
  const isEnded = displayPoll?.status === "ended";
  const winner = lastResult?.winner;

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <CardHeader />
        {isEnded && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">Encerrada</span>
            <button
              onClick={clearCurrentPoll}
              title="Limpar prévia e overlay"
              className="flex items-center gap-1 text-zinc-500 hover:text-red-400 text-xs transition-colors"
            >
              <Trash2 size={13} />
              Limpar
            </button>
          </div>
        )}
      </div>

      <h3 className="text-white font-semibold text-base leading-snug">{displayPoll?.question}</h3>

      <div className="space-y-3">
        {options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isWinner = isEnded && winner?.id === opt.id;

          return (
            <div key={opt.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className={`font-medium ${isWinner ? "text-indigo-300" : "text-zinc-300"}`}>
                  <span className="text-zinc-500 mr-1.5">{i + 1}.</span>
                  {opt.label}
                  {isWinner && " 🏆"}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {opt.votes} <span className="text-zinc-600">({pct}%)</span>
                </span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWinner ? "bg-indigo-500" : "bg-zinc-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-zinc-500 text-xs text-right">
        {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
