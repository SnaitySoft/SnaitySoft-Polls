"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";

const PLATFORM_COLOR: Record<string, string> = {
  twitch: "text-purple-400",
  youtube: "text-red-400",
  kick: "text-green-400",
};

export function ChatLog() {
  const { chatLog, clearLog } = usePollStore();

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 flex flex-col h-full min-h-[420px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={17} className="text-indigo-400" />
          <span className="text-white font-semibold text-sm">Chat</span>
        </div>
        <button
          onClick={clearLog}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs transition-colors"
        >
          <Trash2 size={13} />
          Limpar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
        {chatLog.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
            <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center">
              <MessageSquare size={26} className="text-indigo-500/70" />
            </div>
            <p className="text-zinc-300 text-sm font-medium">Sem mensagens ainda</p>
            <p className="text-zinc-600 text-xs">As mensagens do chat aparecerão aqui.</p>
          </div>
        ) : (
          chatLog.map((msg, i) => (
            <div key={i} className="flex items-baseline gap-2 text-sm">
              <span className={`font-medium shrink-0 ${PLATFORM_COLOR[msg.platform] ?? "text-zinc-400"}`}>
                {msg.username}
              </span>
              <span className="text-zinc-300 break-words">{msg.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
