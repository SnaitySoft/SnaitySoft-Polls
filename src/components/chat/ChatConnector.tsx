"use client";

import { Settings as SettingsIcon, Link2 } from "lucide-react";
import { usePollStore, ConnectionStatus } from "@/store/usePollStore";
import { ChatConnectionActions } from "@/hooks/useChatConnections";
import { Toggle } from "@/components/ui/Toggle";
import { TwitchIcon, YouTubeIcon, KickIcon } from "@/components/icons/BrandIcons";
import { StatusDot, statusLabel, PlatformBadge } from "@/components/chat/PlatformUI";
import { useTranslation } from "@/lib/i18n/useTranslation";

function PlatformRow({
  badge,
  label,
  connectedAs,
  status,
  autoEnabled,
  canConnect,
  onToggleAuto,
  onConnect,
  onDisconnect,
  onOpenConnections,
  connectClass,
}: {
  badge: React.ReactNode;
  label: string;
  connectedAs: string;
  status: ConnectionStatus;
  autoEnabled: boolean;
  canConnect: boolean;
  onToggleAuto: (enabled: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenConnections: () => void;
  connectClass: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {badge}
        <div className="min-w-0">
          <p className="text-zinc-200 font-medium text-sm">{label}</p>
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-zinc-500 text-xs truncate">{statusLabel(status, connectedAs, t)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-zinc-500 text-xs">{t("chatConnector.auto")}</span>
        <Toggle
          enabled={autoEnabled}
          onChange={onToggleAuto}
          disabled={!canConnect}
          title={
            !canConnect
              ? t("chatConnector.conecteBotPrimeiro")
              : autoEnabled
              ? t("chatConnector.autoConectarAtivado")
              : t("chatConnector.autoConectarDesativado")
          }
        />
        {status === "connected" ? (
          <button
            onClick={onDisconnect}
            className="text-xs px-3 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            {t("common.desconectar")}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={!canConnect || status === "connecting"}
            className={`text-xs px-3 py-1 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${connectClass}`}
          >
            {status === "connecting" ? t("common.conectando") : t("common.conectar")}
          </button>
        )}
        <button
          onClick={onOpenConnections}
          title={t("chatConnector.configurarBotTitle")}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </div>
  );
}

export function ChatConnector({
  actions,
  onOpenConnections,
}: {
  actions: ChatConnectionActions;
  onOpenConnections: () => void;
}) {
  const { t } = useTranslation();
  const { settings, connections } = usePollStore();

  const canConnectTwitch = !!settings.twitchBot.refreshToken;
  const canConnectYouTube = !!settings.youtubeConfig.liveUrl;
  const canConnectKick = !!settings.kickBot.refreshToken;

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Link2 size={17} className="text-indigo-400" />
          <h2 className="text-white font-semibold text-lg">{t("chatConnector.titulo")}</h2>
        </div>
        <p className="text-zinc-500 text-sm mt-0.5">{t("chatConnector.descricao")}</p>
      </div>

      <PlatformRow
        badge={<PlatformBadge icon={<TwitchIcon size={16} />} className="bg-purple-600" />}
        label="Twitch"
        connectedAs={settings.twitchBot.username && `#${settings.twitchBot.username}`}
        status={connections.twitch}
        autoEnabled={settings.autoConnectTwitch}
        canConnect={canConnectTwitch}
        onToggleAuto={actions.handleToggleTwitch}
        onConnect={actions.connectTwitch}
        onDisconnect={actions.disconnectTwitch}
        onOpenConnections={onOpenConnections}
        connectClass="bg-purple-700 hover:bg-purple-600"
      />

      <PlatformRow
        badge={<PlatformBadge icon={<YouTubeIcon size={16} />} className="bg-red-600" />}
        label="YouTube"
        connectedAs=""
        status={connections.youtube}
        autoEnabled={settings.autoConnectYouTube}
        canConnect={canConnectYouTube}
        onToggleAuto={actions.handleToggleYouTube}
        onConnect={actions.connectYouTube}
        onDisconnect={actions.disconnectYouTube}
        onOpenConnections={onOpenConnections}
        connectClass="bg-red-700 hover:bg-red-600"
      />

      <PlatformRow
        badge={<PlatformBadge icon={<KickIcon size={16} />} className="bg-green-600" />}
        label="Kick"
        connectedAs={settings.kickBot.username && `#${settings.kickBot.username}`}
        status={connections.kick}
        autoEnabled={settings.autoConnectKick}
        canConnect={canConnectKick}
        onToggleAuto={actions.handleToggleKick}
        onConnect={actions.connectKick}
        onDisconnect={actions.disconnectKick}
        onOpenConnections={onOpenConnections}
        connectClass="bg-green-600 hover:bg-green-500"
      />

      {(!canConnectTwitch || !canConnectYouTube || !canConnectKick) && (
        <p className="text-zinc-600 text-xs">
          {t("chatConnector.conecteEmConexoesPrefixo")}{" "}
          <span className="text-zinc-400">{t("sidebar.conexoes")}</span>{" "}
          {t("chatConnector.conecteEmConexoesSufixo")}
        </p>
      )}
    </div>
  );
}
