"use client";

import { usePollStore } from "@/store/usePollStore";
import { PollOption } from "@/lib/poll/types";

export function PollResults() {
  const { poll, lastResult } = usePollStore();

  if (!poll && !lastResult) {
    return (
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 flex items-center justify-center h-40">
        <p className="text-zinc-500 text-sm">Nenhuma poll ativa</p>
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
        <h3 className="text-white font-semibold text-base leading-snug">
          {displayPoll?.question}
        </h3>
        {isEnded && (
          <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full shrink-0">
            Encerrada
          </span>
        )}
      </div>

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
