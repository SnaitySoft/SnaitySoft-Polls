"use client";

import { usePollStore, ConnectionStatus } from "@/store/usePollStore";
import { ChatConnectionActions } from "@/hooks/useChatConnections";
import { BotConnect, TwitchBotConnect, LiveUrlConnect } from "@/components/connections/BotConnect";
import { TwitchIcon, YouTubeIcon, KickIcon } from "@/components/icons/BrandIcons";
import { StatusDot, statusLabel, PlatformBadge } from "@/components/chat/PlatformUI";

function ConnectionCard({
  icon,
  badgeClass,
  accentClass,
  name,
  description,
  status,
  connectedAs,
  children,
}: {
  icon: React.ReactNode;
  badgeClass: string;
  accentClass: string;
  name: string;
  description: string;
  status: ConnectionStatus;
  connectedAs: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-zinc-900 rounded-xl border border-zinc-700 border-t-2 ${accentClass} p-5 flex flex-col gap-4`}
    >
      <div className="flex items-center gap-3">
        <PlatformBadge icon={icon} className={badgeClass} size="lg" />
        <div className="min-w-0">
          <h3 className="text-white font-semibold">{name}</h3>
          <div className="flex items-center gap-1.5">
            <StatusDot status={status} />
            <span className="text-zinc-500 text-xs truncate">{statusLabel(status, connectedAs)}</span>
          </div>
        </div>
      </div>

      <p className="text-zinc-500 text-xs">{description}</p>

      <div className="mt-auto">{children}</div>
    </div>
  );
}

export function ConnectionsView({ actions }: { actions: ChatConnectionActions }) {
  const { settings, connections } = usePollStore();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-white font-semibold text-xl">Conexões</h2>
        <p className="text-zinc-500 text-sm mt-0.5">
          Conecte uma conta de bot por plataforma — ela lê e posta no chat do seu canal/live.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
        <ConnectionCard
          icon={<TwitchIcon size={20} />}
          badgeClass="bg-purple-600"
          accentClass="border-t-purple-500"
          name="Twitch"
          description="Lê e posta no chat do seu canal usando a conta do bot conectado."
          status={connections.twitch}
          connectedAs={settings.twitchBot.username && `#${settings.twitchBot.username}`}
        >
          <TwitchBotConnect
            connectedAs={settings.twitchBot.username}
            onStart={actions.startTwitchBotLogin}
            onFinish={actions.finishTwitchBotLogin}
            onDisconnect={actions.logoutTwitchBot}
          />
        </ConnectionCard>

        <ConnectionCard
          icon={<YouTubeIcon size={20} />}
          badgeClass="bg-red-600"
          accentClass="border-t-red-500"
          name="YouTube"
          description="Lê o chat da live colada abaixo. Sem login — não posta mensagens no YouTube."
          status={connections.youtube}
          connectedAs={connections.youtube === "connected" ? "live conectada" : ""}
        >
          <LiveUrlConnect
            liveUrl={settings.youtubeConfig.liveUrl}
            connected={connections.youtube === "connected" || connections.youtube === "connecting"}
            onSetLiveUrl={actions.setYoutubeLiveUrl}
            onConnect={actions.connectYouTube}
            onDisconnect={actions.disconnectYouTube}
          />
        </ConnectionCard>

        <ConnectionCard
          icon={<KickIcon size={20} />}
          badgeClass="bg-green-600"
          accentClass="border-t-green-500"
          name="Kick"
          description="Lê e posta no chat do canal do bot conectado."
          status={connections.kick}
          connectedAs={settings.kickBot.username && `#${settings.kickBot.username}`}
        >
          <div className="space-y-2">
            <BotConnect
              label="da Kick"
              connectedAs={settings.kickBot.username}
              onConnect={actions.loginKickBot}
              onDisconnect={actions.logoutKickBot}
              accentClass="bg-green-600 hover:bg-green-500"
            />
            <p className="text-zinc-600 text-xs">
              A leitura do chat da Kick usa um canal não-oficial da própria Kick — se parar de
              funcionar de uma hora pra outra, pode ser mudança do lado deles.
            </p>
          </div>
        </ConnectionCard>
      </div>
    </div>
  );
}
