"use client";

import { useEffect, useMemo, useState } from "react";
import { Gamepad2, Play, RotateCcw, EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Toggle } from "@/components/ui/Toggle";
import { RouletteWheel } from "./RouletteWheel";
import { buildEntriesFromList, pickWeightedWinner, RouletteEntry } from "@/lib/roulette/engine";
import { broadcastRouletteSpin, broadcastRoulettePreview, broadcastRouletteClear } from "@/lib/roulette/overlay";

interface GameListRouletteProps {
  sendToOverlay: boolean;
  colors: readonly string[];
  durationMs: number;
  showLabels: boolean;
  scale: number;
  soundEnabled: boolean;
  soundVolume: number;
}

export function GameListRoulette({
  sendToOverlay,
  colors,
  durationMs,
  showLabels,
  scale,
  soundEnabled,
  soundVolume,
}: GameListRouletteProps) {
  const { t } = useTranslation();

  const [text, setText] = useState("");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [excludeWinner, setExcludeWinner] = useState(true);
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winner, setWinner] = useState<RouletteEntry | null>(null);

  const allEntries = useMemo(() => buildEntriesFromList(text.split("\n")), [text]);
  const entries = useMemo(() => allEntries.filter((e) => !removedIds.includes(e.id)), [allEntries, removedIds]);
  const overlayTitle = t("roulette.modoLista");

  // Hides the overlay's roulette box on navigating away — it's meant to appear only while this
  // screen is actively driving a spin, not linger in OBS after the streamer moves on.
  useEffect(() => broadcastRouletteClear, []);

  // Keeps the overlay's wheel live while the streamer is still pasting/editing the list — not
  // just frozen/blank until the first spin. spinId 0 (see broadcastRoulettePreview) means
  // neither renderer treats this as a spin to animate. Skipped while a winner is showing:
  // "remover item sorteado" changes `entries` right after a spin ends (by excluding the
  // winner), which would otherwise re-fire this and stomp the just-revealed result back to a
  // plain preview.
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
      showParticipantCount: false,
      soundEnabled,
      soundVolume,
    });
  }, [
    entries,
    sendToOverlay,
    spinning,
    winner,
    overlayTitle,
    durationMs,
    colors,
    showLabels,
    scale,
    soundEnabled,
    soundVolume,
  ]);

  function handleSpin() {
    if (entries.length < 2 || spinning) return;
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
        showParticipantCount: false,
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
            <Gamepad2 size={16} />
          </div>
          <h2 className="text-white font-semibold text-lg">{t("roulette.modoLista")}</h2>
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
        <div className="flex items-center justify-between mb-1">
          <label className="text-zinc-400 text-xs uppercase tracking-wide">{t("roulette.lista.itensLabel")}</label>
          <span className="text-zinc-600 text-xs tabular-nums">{allEntries.length}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setWinner(null);
          }}
          placeholder={t("roulette.lista.itensPlaceholder")}
          rows={6}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-y"
        />
      </div>

      <RouletteWheel
        entries={entries}
        spinId={spinId}
        winnerId={winnerId}
        onSpinEnd={handleSpinEnd}
        emptyLabel={t("roulette.lista.minimoDoisItens")}
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
          <p className="text-zinc-300 text-sm font-medium">{t("roulette.lista.removerSorteadoTitulo")}</p>
          <p className="text-zinc-500 text-xs">{t("roulette.lista.removerSorteadoDescricao")}</p>
        </div>
        <Toggle enabled={excludeWinner} onChange={setExcludeWinner} title={t("roulette.lista.removerSorteadoTitulo")} />
      </div>

      <button onClick={handleReset} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs transition-colors">
        <RotateCcw size={12} />
        {t("roulette.resetarSorteio")}
      </button>

      <button
        onClick={handleSpin}
        disabled={entries.length < 2 || spinning}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
      >
        <Play size={16} />
        {spinning ? t("roulette.sorteando") : t("roulette.sortear")}
      </button>
    </div>
  );
}
