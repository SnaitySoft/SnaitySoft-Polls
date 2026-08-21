"use client";

import { useEffect, useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { invoke } from "@tauri-apps/api/core";
import { SaveStatus, useSaveStatus } from "@/hooks/useSettingsPersistence";

export function SettingsPanel({ saveStatus }: { saveStatus: SaveStatus }) {
  const { settings, setSettings } = usePollStore();
  const [overlayPort, setOverlayPort] = useState(0);
  const saveIndicator = useSaveStatus(saveStatus);

  useEffect(() => {
    invoke<number>("get_overlay_port")
      .then(setOverlayPort)
      .catch(() => setOverlayPort(9898));
  }, []);

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Configurações</h2>
        {saveIndicator.label && (
          <span className={`text-xs font-medium transition-all ${saveIndicator.color}`}>
            {saveIndicator.label}
          </span>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-purple-400 text-xs font-semibold uppercase tracking-wide mb-2">
          Twitch
        </legend>
        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Canal (sem #)</label>
          <input
            type="text"
            value={settings.twitchChannel}
            onChange={(e) => setSettings({ twitchChannel: e.target.value.trim() })}
            placeholder="meucanal"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-2">
          YouTube
        </legend>
        <div>
          <label className="text-zinc-400 text-xs mb-1 block">API Key (YouTube Data v3)</label>
          <input
            type="password"
            value={settings.ytApiKey}
            onChange={(e) => setSettings({ ytApiKey: e.target.value.trim() })}
            placeholder="AIza..."
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <label className="text-zinc-400 text-xs mb-1 block">Video ID da live</label>
          <input
            type="text"
            value={settings.ytVideoId}
            onChange={(e) => setSettings({ ytVideoId: e.target.value.trim() })}
            placeholder="dQw4w9WgXcQ"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500"
          />
          <p className="text-zinc-600 text-xs mt-1">
            O ID está na URL: youtube.com/watch?v=
            <span className="text-zinc-400">VIDEO_ID</span>
          </p>
        </div>
      </fieldset>

      {overlayPort > 0 && (
        <div className="bg-zinc-800 rounded-lg px-4 py-3 text-xs text-zinc-400">
          Overlay rodando em{" "}
          <code className="text-indigo-300 font-mono select-all">
            http://localhost:{overlayPort}
          </code>
          <br />
          <span className="text-zinc-500">
            Vá para a aba Poll para ver as instruções de configuração no OBS.
          </span>
        </div>
      )}
    </div>
  );
}
