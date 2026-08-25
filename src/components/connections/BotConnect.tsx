"use client";

import { useState } from "react";
import { useTranslation, useErrorMessage } from "@/lib/i18n/useTranslation";

export function ConnectedBotRow({
  connectedAs,
  onDisconnect,
}: {
  connectedAs: string;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-800 rounded-lg px-3 py-2">
      <span className="text-zinc-300 text-sm truncate">
        {t("botConnect.conectadoComo")} <span className="text-white font-medium">{connectedAs}</span>
      </span>
      <button
        onClick={onDisconnect}
        className="text-xs px-2.5 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors shrink-0"
      >
        {t("common.desconectar")}
      </button>
    </div>
  );
}

export function BotConnect({
  connectedAs,
  onConnect,
  onDisconnect,
  accentClass,
}: {
  connectedAs: string;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  accentClass: string;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      await onConnect();
    } catch (e) {
      console.error(t("log.botConnectFailed"), e);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (connectedAs) {
    return <ConnectedBotRow connectedAs={connectedAs} onDisconnect={onDisconnect} />;
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className={`text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${accentClass}`}
      >
        {loading ? t("botConnect.abrindoNavegador") : t("botConnect.conectarKick")}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function LiveUrlConnect({
  liveUrl,
  connected,
  onSetLiveUrl,
  onConnect,
  onDisconnect,
}: {
  liveUrl: string;
  connected: boolean;
  onSetLiveUrl: (liveUrl: string) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(liveUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (!value.trim()) return;
    setLoading(true);
    setError("");
    try {
      onSetLiveUrl(value.trim());
      await onConnect();
    } catch (e) {
      console.error(t("log.youtubeBotConnectFailed"), e);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return <ConnectedBotRow connectedAs={t("connections.liveConectada")} onDisconnect={onDisconnect} />;
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("botConnect.liveUrlPlaceholder")}
        className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-600"
      />
      <button
        onClick={handleConnect}
        disabled={loading || !value.trim()}
        className="text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 bg-red-700 hover:bg-red-600"
      >
        {loading ? t("common.conectando") : t("common.conectar")}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface TwitchDeviceStart {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

export function TwitchBotConnect({
  connectedAs,
  onStart,
  onFinish,
  onDisconnect,
}: {
  connectedAs: string;
  onStart: () => Promise<TwitchDeviceStart>;
  onFinish: (device: TwitchDeviceStart) => Promise<void>;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<"idle" | "waiting" | "polling">("idle");
  const [device, setDevice] = useState<TwitchDeviceStart | null>(null);
  const [error, setError] = useState("");

  async function handleConnect() {
    setError("");
    setStatus("waiting");
    try {
      const started = await onStart();
      setDevice(started);
      setStatus("polling");
      await onFinish(started);
      setStatus("idle");
      setDevice(null);
    } catch (e) {
      console.error(t("log.twitchBotConnectFailed"), e);
      setError(errorMessage(e));
      setStatus("idle");
      setDevice(null);
    }
  }

  if (connectedAs) {
    return <ConnectedBotRow connectedAs={connectedAs} onDisconnect={onDisconnect} />;
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={status !== "idle"}
        className="text-sm px-3 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 bg-purple-700 hover:bg-purple-600"
      >
        {status === "idle" && t("botConnect.conectarTwitch")}
        {status === "waiting" && t("botConnect.abrindoNavegador")}
        {status === "polling" && t("botConnect.aguardandoConfirmacao")}
      </button>
      {device && (
        <div className="mt-2 bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 space-y-1">
          <p>
            {t("botConnect.confirmeEm")}{" "}
            <a
              href={device.verificationUri}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 underline"
            >
              {device.verificationUri}
            </a>{" "}
            {t("botConnect.comOCodigo")}
          </p>
          <p className="text-white font-mono text-base tracking-widest select-all">{device.userCode}</p>
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
