"use client";

import { PollOption } from "@/lib/poll/types";

interface OverlayData {
  question: string;
  options: PollOption[];
  status: string;
  endsAt: number;
  totalVoters: number;
}

interface OverlayViewProps {
  data: OverlayData | null;
  transparent?: boolean;
}

export function OverlayView({ data, transparent = false }: OverlayViewProps) {
  if (!data || data.status === "idle") {
    return transparent ? null : (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Aguardando poll...
      </div>
    );
  }

  const totalVotes = data.options.reduce((s, o) => s + o.votes, 0);
  const isEnded = data.status === "ended";
  const winner = isEnded
    ? data.options.reduce((a, b) => (b.votes > a.votes ? b : a), data.options[0])
    : null;

  return (
    <div
      className={`w-full rounded-2xl p-5 space-y-3 ${
        transparent ? "bg-black/70 backdrop-blur" : "bg-zinc-900"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-white font-bold text-base leading-snug">{data.question}</p>
        {isEnded && (
          <span className="shrink-0 text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
            Encerrada
          </span>
        )}
      </div>

      <div className="space-y-2">
        {data.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          const isWin = winner?.id === opt.id;

          return (
            <div key={opt.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className={`font-medium ${isWin ? "text-indigo-300" : "text-zinc-300"}`}>
                  {i + 1}. {opt.label}
                  {isWin && isEnded && " 🏆"}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {opt.votes} ({pct}%)
                </span>
              </div>
              <div className="bg-zinc-800/80 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWin ? "bg-indigo-500" : "bg-zinc-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-zinc-500 text-xs text-right">
        {data.totalVoters} voto{data.totalVoters !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
