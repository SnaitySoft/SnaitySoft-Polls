"use client";

import { History, Trash2 } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PollHistory() {
  const { history, deleteHistoryEntry, clearHistory } = usePollStore();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-xl">Histórico</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Polls já encerradas e seus resultados.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-10 border border-zinc-700 flex flex-col items-center justify-center text-center gap-2">
          <History size={32} className="text-zinc-700" />
          <p className="text-zinc-400 text-sm font-medium">Nenhuma poll encerrada ainda</p>
          <p className="text-zinc-600 text-xs">O resultado de cada poll encerrada aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.poll.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{entry.poll.question}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">{formatDate(entry.poll.startedAt)}</p>
                </div>
                <button
                  onClick={() => deleteHistoryEntry(entry.poll.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors shrink-0"
                  title="Excluir do histórico"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {entry.poll.options.map((opt) => {
                  const pct = entry.percentages[opt.id] ?? 0;
                  const isWinner = entry.winner?.id === opt.id;
                  return (
                    <div key={opt.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isWinner ? "text-indigo-300 font-medium" : "text-zinc-400"}>
                          {opt.label}
                          {isWinner && " 🏆"}
                        </span>
                        <span className="text-zinc-500 tabular-nums">
                          {opt.votes} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isWinner ? "bg-indigo-500" : "bg-zinc-600"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-zinc-600 text-xs text-right mt-2">
                {entry.totalVotes} voto{entry.totalVotes !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
