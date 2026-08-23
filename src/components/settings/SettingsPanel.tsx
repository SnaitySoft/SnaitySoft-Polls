"use client";

import { useState } from "react";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { SaveStatus, useSaveStatus } from "@/hooks/useSettingsPersistence";
import { Toggle } from "@/components/ui/Toggle";

const AUTO_CLEAR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Nunca" },
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1min" },
  { value: 120, label: "2min" },
  { value: 300, label: "5min" },
];

function ResetDataButton() {
  const resetAllData = usePollStore((s) => s.resetAllData);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-xs">Tem certeza? Isso desconecta os bots e apaga tudo.</span>
        <button
          onClick={() => {
            resetAllData();
            setConfirming(false);
          }}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors shrink-0"
        >
          Confirmar
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors shrink-0"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/50 transition-colors"
    >
      Limpar todos os dados do app
    </button>
  );
}

export function SettingsPanel({ saveStatus }: { saveStatus: SaveStatus }) {
  const { settings, setSettings } = usePollStore();
  const saveIndicator = useSaveStatus(saveStatus);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-xl">Configurações</h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            Contas de bot ficam em &quot;Conexões&quot;, o guia do overlay fica em &quot;Nova Poll&quot;.
          </p>
        </div>
        {saveIndicator.label && (
          <span className={`text-xs font-medium transition-all ${saveIndicator.color}`}>
            {saveIndicator.label}
          </span>
        )}
      </div>

      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-indigo-400" />
          <h3 className="text-white font-semibold text-sm">Configurações avançadas</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-zinc-300 text-sm font-medium">Anunciar poll no chat automaticamente</p>
            <p className="text-zinc-500 text-xs">
              Quando um bot está conectado, avisa no chat quando a poll começa e termina.
            </p>
          </div>
          <Toggle
            enabled={settings.announceInChat}
            onChange={(enabled) => setSettings({ announceInChat: enabled })}
            title={settings.announceInChat ? "Anúncio automático ativado" : "Anúncio automático desativado"}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-zinc-300 text-sm font-medium">Máximo de opções por poll</p>
            <p className="text-zinc-500 text-xs">
              Limite de opções ao criar uma poll (o chat vota por número ou letra).
            </p>
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
          <p className="text-zinc-300 text-sm font-medium">Limpar automaticamente após encerrar</p>
          <p className="text-zinc-500 text-xs mb-2">
            Some com a prévia e o overlay sozinho depois desse tempo, sem precisar clicar em
            &quot;Limpar&quot;.
          </p>
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
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <TriangleAlert size={14} className="text-red-500" />
            <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Zona de perigo</p>
          </div>
          <p className="text-zinc-500 text-xs">
            Apaga configurações, contas de bot conectadas, modelos salvos e histórico. Não afeta uma poll
            em andamento.
          </p>
          <ResetDataButton />
        </div>
      </div>
    </div>
  );
}
