"use client";

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Languages, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { usePollStore, Locale } from "@/store/usePollStore";
import { SaveStatus, useSaveStatus } from "@/hooks/useSettingsPersistence";
import { Toggle } from "@/components/ui/Toggle";
import { useToastStore } from "@/store/useToastStore";
import { useTranslation, useErrorMessage } from "@/lib/i18n/useTranslation";

const AUTO_CLEAR_OPTIONS: { value: number; labelKey: "settings.autoClearNunca" | null; rawLabel?: string }[] = [
  { value: 0, labelKey: "settings.autoClearNunca" },
  { value: 10, labelKey: null, rawLabel: "10s" },
  { value: 30, labelKey: null, rawLabel: "30s" },
  { value: 60, labelKey: null, rawLabel: "1min" },
  { value: 120, labelKey: null, rawLabel: "2min" },
  { value: 300, labelKey: null, rawLabel: "5min" },
];

function LanguageToggle() {
  const { t, locale } = useTranslation();
  const setSettings = usePollStore((s) => s.setSettings);

  const options: { value: Locale; label: string }[] = [
    { value: "pt", label: "Português" },
    { value: "en", label: "English" },
  ];

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Languages size={15} className="text-zinc-400" />
        <p className="text-zinc-300 text-sm font-medium">{t("settings.idioma")}</p>
      </div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSettings({ locale: opt.value })}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              locale === opt.value ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResetDataButton() {
  const { t } = useTranslation();
  const resetAllData = usePollStore((s) => s.resetAllData);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-xs">{t("settings.limparTudoConfirmacao")}</span>
        <button
          onClick={() => {
            resetAllData();
            setConfirming(false);
          }}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors shrink-0"
        >
          {t("common.confirmar")}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors shrink-0"
        >
          {t("common.cancelar")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/50 transition-colors"
    >
      {t("settings.limparTodosDados")}
    </button>
  );
}

function LogFolderButton() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const pushToast = useToastStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await invoke<string>("open_log_folder");
    } catch (e) {
      console.error(t("log.openLogFolderFailed"), e);
      pushToast(errorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
    >
      <FolderOpen size={13} />
      {t("settings.abrirPastaLogs")}
    </button>
  );
}

export function SettingsPanel({ saveStatus }: { saveStatus: SaveStatus }) {
  const { t } = useTranslation();
  const { settings, setSettings } = usePollStore();
  const saveIndicator = useSaveStatus(saveStatus);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-xl">{t("settings.titulo")}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">{t("settings.subtitulo")}</p>
        </div>
        {saveIndicator.label && (
          <span className={`text-xs font-medium transition-all ${saveIndicator.color}`}>
            {saveIndicator.label}
          </span>
        )}
      </div>

      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-5">
        <LanguageToggle />

        <div className="border-t border-zinc-800 pt-4 space-y-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={17} className="text-indigo-400" />
            <h3 className="text-white font-semibold text-sm">{t("settings.avancadas")}</h3>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-zinc-300 text-sm font-medium">{t("settings.anunciarTitulo")}</p>
              <p className="text-zinc-500 text-xs">{t("settings.anunciarDescricao")}</p>
            </div>
            <Toggle
              enabled={settings.announceInChat}
              onChange={(enabled) => setSettings({ announceInChat: enabled })}
              title={settings.announceInChat ? t("settings.anuncioAtivado") : t("settings.anuncioDesativado")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-zinc-300 text-sm font-medium">{t("settings.maxOpcoesTitulo")}</p>
              <p className="text-zinc-500 text-xs">{t("settings.maxOpcoesDescricao")}</p>
            </div>
            <input
              type="number"
              value={settings.maxPollOptions}
              onChange={(e) => {
                const value = Math.max(2, Math.min(26, Number(e.target.value) || 2));
                setSettings({ maxPollOptions: value });
              }}
              min={2}
              max={26}
              className="w-16 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-indigo-500 shrink-0"
            />
          </div>

          <div>
            <p className="text-zinc-300 text-sm font-medium">{t("settings.autoClearTitulo")}</p>
            <p className="text-zinc-500 text-xs mb-2">{t("settings.autoClearDescricao")}</p>
            <div className="flex flex-wrap gap-2">
              {AUTO_CLEAR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings({ autoClearDelay: opt.value })}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    settings.autoClearDelay === opt.value
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {opt.labelKey ? t(opt.labelKey) : opt.rawLabel}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <p className="text-zinc-300 text-sm font-medium">{t("settings.logsTitulo")}</p>
          <p className="text-zinc-500 text-xs">{t("settings.logsDescricao")}</p>
          <LogFolderButton />
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <TriangleAlert size={14} className="text-red-500" />
            <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">
              {t("settings.zonaDePerigo")}
            </p>
          </div>
          <p className="text-zinc-500 text-xs">{t("settings.zonaDePerigoDescricao")}</p>
          <ResetDataButton />
        </div>
      </div>
    </div>
  );
}
