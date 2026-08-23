"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SquarePlus, ListChecks, History, Link2, Settings } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";

export type NavSection = "nova-poll" | "minhas-polls" | "historico" | "conexoes" | "configuracoes";

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ElementType }[] = [
  { id: "nova-poll", label: "Nova Poll", icon: SquarePlus },
  { id: "minhas-polls", label: "Minhas Polls", icon: ListChecks },
  { id: "historico", label: "Histórico", icon: History },
  { id: "conexoes", label: "Conexões", icon: Link2 },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({
  active,
  onChange,
}: {
  active: NavSection;
  onChange: (section: NavSection) => void;
}) {
  const [port, setPort] = useState(9898);

  useEffect(() => {
    invoke<number>("get_overlay_port")
      .then(setPort)
      .catch(() => {});
  }, []);

  const overlayUrl = `http://localhost:${port}`;

  return (
    <aside className="w-64 shrink-0 h-screen flex flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export + unoptimized images, plain img is fine */}
        <img src="/icon.png" alt="" className="w-8 h-8 rounded-lg shrink-0" />
        <span className="text-white font-bold text-base tracking-tight">SnaitySoft Polls</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-1.5">
        <p className="text-zinc-500 text-xs">Overlay rodando em</p>
        <div className="flex items-center gap-1.5">
          <code className="flex-1 min-w-0 text-indigo-300 font-mono text-xs truncate">{overlayUrl}</code>
          <CopyButton
            text={overlayUrl}
            iconOnly
            className="shrink-0 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
          />
        </div>
      </div>
    </aside>
  );
}
