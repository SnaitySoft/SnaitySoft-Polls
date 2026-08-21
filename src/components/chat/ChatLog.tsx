"use client";

import { usePollStore } from "@/store/usePollStore";

export function ChatLog() {
  const { chatLog, clearLog } = usePollStore();

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 flex flex-col h-48">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">
          Chat ({chatLog.length})
        </span>
        <button
          onClick={clearLog}
          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          Limpar
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
        {chatLog.length === 0 ? (
          <p className="text-zinc-600 text-xs py-2">Sem mensagens</p>
        ) : (
          chatLog.map((msg, i) => (
            <div key={i} className="flex items-baseline gap-2 text-xs">
              <span
                className={`font-medium shrink-0 ${
                  msg.platform === "twitch" ? "text-purple-400" : "text-red-400"
                }`}
              >
                {msg.username}
              </span>
              <span className="text-zinc-300 truncate">{msg.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
