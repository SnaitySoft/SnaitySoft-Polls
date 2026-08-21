"use client";

import { usePollStore, ConnectionStatus } from "@/store/usePollStore";
import { ChatConnectionActions } from "@/hooks/useChatConnections";
import { Toggle } from "@/components/ui/Toggle";

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
      ? "bg-yellow-400 animate-pulse"
      : status === "error"
      ? "bg-red-500"
      : "bg-zinc-600";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function ChatConnector({ actions }: { actions: ChatConnectionActions }) {
  const { settings, connections } = usePollStore();

  const {
    connectTwitch,
    disconnectTwitch,
    connectYouTube,
    disconnectYouTube,
    handleToggleTwitch,
    handleToggleYouTube,
  } = actions;

  const canConnectTwitch = !!settings.twitchChannel;
  const canConnectYouTube = !!settings.ytApiKey && !!settings.ytVideoId;

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <h2 className="text-white font-semibold text-lg">Conexões de Chat</h2>

      {/* Twitch */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={connections.twitch} />
          <span className="text-zinc-300 font-medium text-sm">Twitch</span>
          {settings.twitchChannel && (
            <span className="text-zinc-500 text-sm truncate">#{settings.twitchChannel}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-500 text-xs">Auto</span>
          <Toggle
            enabled={settings.autoConnectTwitch}
            onChange={handleToggleTwitch}
            disabled={!canConnectTwitch}
            title={
              !canConnectTwitch
                ? "Preencha as credenciais primeiro"
                : settings.autoConnectTwitch
                ? "Auto-conectar ativado"
                : "Auto-conectar desativado"
            }
          />
          {connections.twitch === "connected" ? (
            <button
              onClick={disconnectTwitch}
              className="text-xs px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={connectTwitch}
              disabled={!canConnectTwitch || connections.twitch === "connecting"}
              className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {connections.twitch === "connecting" ? "Conectando…" : "Conectar"}
            </button>
          )}
        </div>
      </div>

      {/* YouTube */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={connections.youtube} />
          <span className="text-zinc-300 font-medium text-sm">YouTube</span>
          {settings.ytVideoId && (
            <span className="text-zinc-500 text-sm truncate max-w-[100px]">
              {settings.ytVideoId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-zinc-500 text-xs">Auto</span>
          <Toggle
            enabled={settings.autoConnectYouTube}
            onChange={handleToggleYouTube}
            disabled={!canConnectYouTube}
            title={
              !canConnectYouTube
                ? "Preencha as credenciais primeiro"
                : settings.autoConnectYouTube
                ? "Auto-conectar ativado"
                : "Auto-conectar desativado"
            }
          />
          {connections.youtube === "connected" ? (
            <button
              onClick={disconnectYouTube}
              className="text-xs px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={connectYouTube}
              disabled={!canConnectYouTube || connections.youtube === "connecting"}
              className="text-xs px-3 py-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {connections.youtube === "connecting" ? "Conectando…" : "Conectar"}
            </button>
          )}
        </div>
      </div>

      {(!canConnectTwitch || !canConnectYouTube) && (
        <p className="text-zinc-600 text-xs">
          Configure as credenciais em{" "}
          <span className="text-zinc-400">Configurações</span> para habilitar o auto-conectar.
        </p>
      )}
    </div>
  );
}
