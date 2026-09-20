"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Users, Gamepad2, Palette } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { CopyButton } from "@/components/ui/CopyButton";
import { Toggle } from "@/components/ui/Toggle";
import { useRouletteCustomization } from "@/hooks/useRouletteCustomization";
import {
  WHEEL_THEMES,
  WheelThemeKey,
  SPIN_DURATION_OPTIONS,
  WHEEL_SIZE_OPTIONS,
  wheelScaleFor,
} from "@/lib/roulette/engine";
import { ChatKeywordRoulette } from "./ChatKeywordRoulette";
import { GameListRoulette } from "./GameListRoulette";

type Mode = "chat" | "lista";

const PRESET_THEME_KEYS = Object.keys(WHEEL_THEMES) as Exclude<WheelThemeKey, "custom">[];
const THEME_KEYS: WheelThemeKey[] = [...PRESET_THEME_KEYS, "custom"];

export function RouletteView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("chat");
  const [port, setPort] = useState(9898);
  const [sendToOverlay, setSendToOverlay] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const {
    theme,
    setTheme,
    customColors,
    setCustomColors,
    durationMs,
    setDurationMs,
    showLabels,
    setShowLabels,
    wheelSize,
    setWheelSize,
    soundEnabled,
    setSoundEnabled,
    soundVolume,
    setSoundVolume,
  } = useRouletteCustomization();

  useEffect(() => {
    invoke<number>("get_overlay_port")
      .then(setPort)
      .catch(() => {});
  }, []);

  const overlayUrl = `http://localhost:${port}/?view=roulette`;
  const colors = theme === "custom" ? customColors : WHEEL_THEMES[theme];
  const scale = wheelScaleFor(wheelSize);

  function updateCustomColor(index: number, value: string) {
    setCustomColors(customColors.map((c, i) => (i === index ? value : c)));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-white font-semibold text-xl">{t("roulette.titulo")}</h1>
        <p className="text-zinc-500 text-sm">{t("roulette.descricao")}</p>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-3 space-y-3">
        <div className="space-y-1.5">
          <p className="text-zinc-500 text-xs">{t("roulette.overlayUrlLabel")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-indigo-300 font-mono text-xs truncate">{overlayUrl}</code>
            <CopyButton text={overlayUrl} />
          </div>
          <p className="text-zinc-600 text-xs">{t("roulette.overlayTamanhoRecomendado")}</p>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-800">
          <div className="min-w-0">
            <p className="text-zinc-300 text-sm font-medium">{t("roulette.mostrarNoOverlayTitulo")}</p>
            <p className="text-zinc-500 text-xs">{t("roulette.mostrarNoOverlayDescricao")}</p>
          </div>
          <Toggle
            enabled={sendToOverlay}
            onChange={setSendToOverlay}
            title={sendToOverlay ? t("roulette.mostrarNoOverlayAtivado") : t("roulette.mostrarNoOverlayDesativado")}
          />
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
        <button
          onClick={() => setCustomizeOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Palette size={15} className="text-indigo-400" />
            <span className="text-white font-medium text-sm">{t("roulette.personalizar.titulo")}</span>
          </div>
          <span className="text-zinc-500 text-xs">
            {customizeOpen ? t("overlayGuide.fechar") : t("overlayGuide.verInstrucoes")}
          </span>
        </button>

        {customizeOpen && (
          <div className="px-3 pb-3 space-y-4 border-t border-zinc-800 pt-3">
            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wide block mb-1.5">
                {t("roulette.personalizar.tema")}
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_KEYS.map((key) => {
                  const swatches = key === "custom" ? customColors : WHEEL_THEMES[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        theme === key ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      <span className="flex -space-x-0.5">
                        {swatches.slice(0, 4).map((c, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full border border-zinc-900" style={{ background: c }} />
                        ))}
                      </span>
                      {t(`roulette.personalizar.tema.${key}`)}
                    </button>
                  );
                })}
              </div>

              {theme === "custom" && (
                <div className="flex flex-wrap gap-2 mt-2.5 bg-zinc-800/60 rounded-lg p-2.5">
                  {customColors.map((c, i) => (
                    <input
                      key={i}
                      type="color"
                      value={c}
                      onChange={(e) => updateCustomColor(i, e.target.value)}
                      title={t("roulette.personalizar.corDaFatia", { n: i + 1 })}
                      className="w-8 h-8 rounded-md border border-zinc-600 bg-transparent cursor-pointer p-0"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wide block mb-1.5">
                {t("roulette.personalizar.tamanho")}
              </label>
              <div className="flex flex-wrap gap-2">
                {WHEEL_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setWheelSize(opt.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      wheelSize === opt.key ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {t(`roulette.personalizar.tamanho.${opt.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-zinc-400 text-xs uppercase tracking-wide block mb-1.5">
                {t("roulette.personalizar.duracao")}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPIN_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setDurationMs(opt.ms)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      durationMs === opt.ms
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {t(`roulette.personalizar.duracao.${opt.key}`, { s: opt.ms / 1000 })}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-300 text-sm font-medium">{t("roulette.personalizar.mostrarNomesTitulo")}</p>
                <p className="text-zinc-500 text-xs">{t("roulette.personalizar.mostrarNomesDescricao")}</p>
              </div>
              <Toggle enabled={showLabels} onChange={setShowLabels} title={t("roulette.personalizar.mostrarNomesTitulo")} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-300 text-sm font-medium">{t("roulette.personalizar.somTitulo")}</p>
                <p className="text-zinc-500 text-xs">{t("roulette.personalizar.somDescricao")}</p>
              </div>
              <Toggle enabled={soundEnabled} onChange={setSoundEnabled} title={t("roulette.personalizar.somTitulo")} />
            </div>

            {soundEnabled && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-400 text-xs uppercase tracking-wide">
                    {t("roulette.personalizar.volume")}
                  </label>
                  <span className="text-zinc-500 text-xs tabular-nums">{soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "chat"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
              : "bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Users size={16} />
          {t("roulette.modoChat")}
        </button>
        <button
          onClick={() => setMode("lista")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "lista"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
              : "bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Gamepad2 size={16} />
          {t("roulette.modoLista")}
        </button>
      </div>

      {mode === "chat" ? (
        <ChatKeywordRoulette
          sendToOverlay={sendToOverlay}
          colors={colors}
          durationMs={durationMs}
          showLabels={showLabels}
          scale={scale}
          soundEnabled={soundEnabled}
          soundVolume={soundVolume}
        />
      ) : (
        <GameListRoulette
          sendToOverlay={sendToOverlay}
          colors={colors}
          durationMs={durationMs}
          showLabels={showLabels}
          scale={scale}
          soundEnabled={soundEnabled}
          soundVolume={soundVolume}
        />
      )}
    </div>
  );
}
