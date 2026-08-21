"use client";

import { useEffect, useState, useRef } from "react";
import { usePollStore } from "@/store/usePollStore";

export function PollTimer() {
  const { poll, endCurrentPoll } = usePollStore();
  const [remaining, setRemaining] = useState(0);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!poll || poll.status !== "active") {
      setRemaining(0);
      endedRef.current = false;
      return;
    }

    endedRef.current = false;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, poll.endsAt - now);
      setRemaining(left);

      if (left === 0 && !endedRef.current) {
        endedRef.current = true;
        endCurrentPoll();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [poll, endCurrentPoll]);

  if (!poll || poll.status !== "active") return null;

  const totalMs = poll.durationSec * 1000;
  const pct = totalMs > 0 ? (remaining / totalMs) * 100 : 0;
  const seconds = Math.ceil(remaining / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${seconds}s`;

  const colorClass =
    pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">Tempo restante</span>
        <span
          className={`font-mono font-bold text-lg ${
            pct <= 20 ? "text-red-400" : pct <= 50 ? "text-yellow-400" : "text-green-400"
          }`}
        >
          {timeStr}
        </span>
      </div>
      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
