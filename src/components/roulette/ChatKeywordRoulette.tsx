"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Play, RotateCcw, EyeOff } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Toggle } from "@/components/ui/Toggle";
import { RouletteWheel } from "./RouletteWheel";
import { buildEntriesFromChat, pickWeightedWinner, RouletteEntry } from "@/lib/roulette/engine";
import { broadcastRouletteSpin, broadcastRoulettePreview, broadcastRouletteClear } from "@/lib/roulette/overlay";

const PLATFORM_LABEL: Record<string, string> = { twitch: "Twitch", youtube: "YouTube", kick: "Kick" };

interface ChatKeywordRouletteProps {
  sendToOverlay: boolean;
  colors: readonly string[];
  durationMs: number;
  showLabels: boolean;
  scale: number;
  soundEnabled: boolean;
  soundVolume: number;
}

export function ChatKeywordRoulette({
  sendToOverlay,
  colors,
  durationMs,
  showLabels,
  scale,
  soundEnabled,
  soundVolume,
}: ChatKeywordRouletteProps) {
  const { t } = useTranslation();
  const chatLog = usePollStore((s) => s.chatLog);

  const [keyword, setKeyword] = useState("");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [excludeWinner, setExcludeWinner] = useState(true);
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winner, setWinner] = useState<RouletteEntry | null>(null);

  const allEntries = useMemo(() => buildEntriesFromChat(chatLog, keyword), [chatLog, keyword]);
  const entries = useMemo(() => allEntries.filter((e) => !removedIds.includes(e.id)), [allEntries, removedIds]);
  const overlayTitle = t("roulette.chat.overlayTitulo", { keyword: keyword.trim() });

  // Hides the overlay's roulette box on navigating away — it's meant to appear only while this
  // screen is actively driving a spin, not linger in OBS after the streamer moves on.
  useEffect(() => broadcastRouletteClear, []);

  // Keeps the overlay's wheel live while the streamer is still typing the keyword or waiting for
  // chat to match it — not just frozen/blank until the first spin. spinId 0 (see
  // broadcastRoulettePreview) means neither renderer treats this as a spin to animate. Skipped
  // while a winner is showing: "remover vencedor após sortear" changes `entries` right after a
  // spin ends (by excluding the winner), which would otherwise re-fire this and stomp the
  // just-revealed result back to a plain preview.
  useEffect(() => {
    if (!sendToOverlay || spinning || winner) return;
    if (entries.length === 0) {
      broadcastRouletteClear();
      return;
    }
    broadcastRoulettePreview(overlayTitle, entries, {
      durationMs,
      colors,
      showLabels,
      scale,
      showParticipantCount: true,
      soundEnabled,
      soundVolume,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overlayTitle already reflects keyword
  }, [entries, sendToOverlay, spinning, winner, durationMs, colors, showLabels, scale, soundEnabled, soundVolume]);

  function handleSpin() {
    if (entries.length === 0 || spinning) return;
    const picked = pickWeightedWinner(entries);
    const nextSpinId = spinId + 1;
    setWinner(null);
    setWinnerId(picked.id);
    setSpinning(true);
    setSpinId(nextSpinId);
    if (sendToOverlay) {
      broadcastRouletteSpin(overlayTitle, entries, picked.id, nextSpinId, {
        durationMs,
        colors,
        showLabels,
        scale,
        showParticipantCount: true,
        soundEnabled,
        soundVolume,
      });
    }
  }

  function handleSpinEnd() {
    setSpinning(false);
    const picked = entries.find((e) => e.id === winnerId) ?? null;
    setWinner(picked);
    if (picked && excludeWinner) setRemovedIds((prev) => [...prev, picked.id]);
  }

  function handleReset() {
    setRemovedIds([]);
    setWinner(null);
    setWinnerId(null);
    broadcastRouletteClear();
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border border-indigo-500/50 text-indigo-400 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <h2 className="text-white font-semibold text-lg">{t("roulette.modoChat")}</h2>
        </div>
        <button
          onClick={broadcastRouletteClear}
          title={t("roulette.limparOverlayTitle")}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs transition-colors shrink-0"
        >
          <EyeOff size={13} />
          {t("roulette.limparOverlay")}
        </button>
      </div>

      <div>
        <label className="text-zinc-400 text-xs uppercase tracking-wide block mb-1">
          {t("roulette.chat.palavraChave")}
        </label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setWinner(null);
          }}
          placeholder={t("roulette.chat.palavraChavePlaceholder")}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <RouletteWheel
        entries={entries}
        spinId={spinId}
        winnerId={winnerId}
        onSpinEnd={handleSpinEnd}
        emptyLabel={keyword.trim() ? t("roulette.chat.nenhumaMensagem") : t("roulette.chat.digiteAPalavraChave")}
        colors={colors}
        durationMs={durationMs}
        showLabels={showLabels}
        scale={scale}
      />

      {winner && !spinning && (
        <div className="rounded-lg bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/40 px-4 py-3 text-center">
          <p className="text-zinc-400 text-xs uppercase tracking-wide">{t("roulette.vencedor")}</p>
          <p className="text-white font-bold text-lg break-words">{winner.label}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-zinc-300 text-sm font-medium">{t("roulette.chat.removerVencedorTitulo")}</p>
          <p className="text-zinc-500 text-xs">{t("roulette.chat.removerVencedorDescricao")}</p>
        </div>
        <Toggle enabled={excludeWinner} onChange={setExcludeWinner} title={t("roulette.chat.removerVencedorTitulo")} />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {entries.length} {t(entries.length !== 1 ? "roulette.participantePlural" : "roulette.participanteSingular")}
        </span>
        <button onClick={handleReset} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
          <RotateCcw size={12} />
          {t("roulette.resetarSorteio")}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1.5 border-t border-zinc-800 pt-3">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-300 truncate min-w-0">{e.label}</span>
              <span className="text-zinc-500 text-xs shrink-0">
                {t("roulette.pesoAbrev", { n: e.weight })}
                {e.platforms.length > 1 && ` · ${e.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join("+")}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSpin}
        disabled={entries.length === 0 || spinning}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
      >
        <Play size={16} />
        {spinning ? t("roulette.sorteando") : t("roulette.sortear")}
      </button>
    </div>
  );
}
