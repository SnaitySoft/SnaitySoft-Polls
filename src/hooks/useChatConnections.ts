"use client";

import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChatPlatform, EMPTY_TWITCH_BOT, EMPTY_KICK_BOT, usePollStore } from "@/store/usePollStore";
import { TwitchChatConnector } from "@/lib/chat/twitch";
import { YouTubeChatConnector } from "@/lib/chat/youtube";
import { KickChatConnector } from "@/lib/chat/kick";
import { getValidTwitchBotToken, getValidKickBotToken } from "@/lib/auth/botTokens";
import { useToastStore } from "@/store/useToastStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PollOption } from "@/lib/poll/types";

const PLATFORM_LABEL: Record<ChatPlatform, string> = { twitch: "Twitch", youtube: "YouTube", kick: "Kick" };

// Twitch's IRC PRIVMSG limit and Kick's documented POST /public/v1/chat "content" field both
// cap at 500 characters — this margin leaves room for encoding differences (unicode/emoji
// byte-length vs character count) rather than cutting it exactly at the wire.
const MAX_ANNOUNCE_LENGTH = 480;

type TFn = ReturnType<typeof useTranslation>["t"];

function hardTruncate(message: string): string {
  return message.length > MAX_ANNOUNCE_LENGTH ? message.slice(0, MAX_ANNOUNCE_LENGTH - 1) + "…" : message;
}

// With up to 10 options and no length cap on option text, the naive "1) label 2) label..."
// list can blow past the platform limit — drop trailing options (replaced by a "+N more"
// count) until it fits, and hard-truncate as a last resort if even the question plus a
// single option doesn't fit.
function buildPollStartedAnnounce(question: string, options: PollOption[], t: TFn): string {
  for (let hidden = 0; hidden <= options.length; hidden++) {
    const visible = hidden === 0 ? options : options.slice(0, options.length - hidden);
    const optionsList =
      visible.map((o, i) => `${i + 1}) ${o.label}`).join("  ") +
      (hidden > 0 ? `  ${t("announce.moreOptions", { n: hidden })}` : "");
    const message = t("announce.pollStarted", { question, options: optionsList });
    if (message.length <= MAX_ANNOUNCE_LENGTH || visible.length <= 1) {
      return hardTruncate(message);
    }
  }
  return hardTruncate(t("announce.pollStarted", { question, options: "" }));
}

interface TwitchDeviceStart {
  userCode: string;
  verificationUri: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

interface TwitchLoginResult {
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface KickLoginResult {
  username: string;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ChatConnectionActions {
  connectTwitch: () => void;
  disconnectTwitch: () => void;
  connectYouTube: () => Promise<void>;
  disconnectYouTube: () => void;
  connectKick: () => void;
  disconnectKick: () => void;
  handleToggleTwitch: (enabled: boolean) => void;
  handleToggleYouTube: (enabled: boolean) => void;
  handleToggleKick: (enabled: boolean) => void;
  startTwitchBotLogin: () => Promise<TwitchDeviceStart>;
  finishTwitchBotLogin: (device: TwitchDeviceStart) => Promise<void>;
  logoutTwitchBot: () => void;
  setYoutubeLiveUrl: (liveUrl: string) => void;
  loginKickBot: () => Promise<void>;
  logoutKickBot: () => void;
}

export function useChatConnections(): ChatConnectionActions {
  const { settings, settingsLoaded, setSettings, setConnectionStatus, processMessage, poll, lastResult, connections } =
    usePollStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const { t } = useTranslation();

  const twitchRef = useRef<TwitchChatConnector | null>(null);
  const youtubeRef = useRef<YouTubeChatConnector | null>(null);
  const kickRef = useRef<KickChatConnector | null>(null);

  // toast whenever a platform's connection transitions INTO "error" — covers auto-connect
  // failures, manual connect failures, and a connection dropping mid-stream alike, so the
  // user finds out even if they're not staring at the Conexões screen when it happens.
  const prevConnections = useRef(connections);
  useEffect(() => {
    (Object.keys(connections) as ChatPlatform[]).forEach((platform) => {
      if (connections[platform] === "error" && prevConnections.current[platform] !== "error") {
        pushToast(t("toast.erroConexaoCom", { platform: PLATFORM_LABEL[platform] }), "error");
      }
    });
    prevConnections.current = connections;
  }, [connections, pushToast, t]);

  // keep a ref to the latest settings so callbacks don't go stale
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const connectTwitch = useCallback(async () => {
    const { twitchBot } = settingsRef.current;
    if (!twitchBot.refreshToken) return;
    twitchRef.current?.disconnect();

    const accessToken = await getValidTwitchBotToken();
    if (!accessToken) return;

    const conn = new TwitchChatConnector(
      { username: twitchBot.username, accessToken },
      processMessage,
      (s) => setConnectionStatus("twitch", s)
    );
    twitchRef.current = conn;
    await conn.connect();
  }, [processMessage, setConnectionStatus]);

  const disconnectTwitch = useCallback(async () => {
    await twitchRef.current?.disconnect();
    twitchRef.current = null;
  }, []);

  const connectYouTube = useCallback(async () => {
    const { youtubeConfig } = settingsRef.current;
    if (!youtubeConfig.liveUrl) return;
    youtubeRef.current?.disconnect();
    const conn = new YouTubeChatConnector(youtubeConfig.liveUrl, processMessage, (s) =>
      setConnectionStatus("youtube", s)
    );
    youtubeRef.current = conn;
    await conn.connect();
  }, [processMessage, setConnectionStatus]);

  const disconnectYouTube = useCallback(() => {
    youtubeRef.current?.disconnect();
    youtubeRef.current = null;
  }, []);

  const connectKick = useCallback(async () => {
    const { kickBot } = settingsRef.current;
    if (!kickBot.refreshToken) return;
    kickRef.current?.disconnect();
    const conn = new KickChatConnector(
      kickBot.username,
      kickBot.userId,
      processMessage,
      (s) => setConnectionStatus("kick", s),
      getValidKickBotToken
    );
    kickRef.current = conn;
    await conn.connect();
  }, [processMessage, setConnectionStatus]);

  const disconnectKick = useCallback(() => {
    kickRef.current?.disconnect();
    kickRef.current = null;
  }, []);

  // auto-connect once after settings are loaded from disk
  useEffect(() => {
    if (!settingsLoaded) return;
    const { autoConnectTwitch, autoConnectYouTube, autoConnectKick, twitchBot, youtubeConfig, kickBot } =
      settingsRef.current;
    if (autoConnectTwitch && twitchBot.refreshToken) connectTwitch();
    // connectYouTube can reject (unlike the other two) so its callers can surface the real
    // error message — swallow it here since this fire-and-forget path has no UI to show it to.
    if (autoConnectYouTube && youtubeConfig.liveUrl) connectYouTube().catch(() => {});
    if (autoConnectKick && kickBot.refreshToken) connectKick();
  }, [settingsLoaded, connectTwitch, connectYouTube, connectKick]);

  // cleanup only when app unmounts (not on tab switch)
  useEffect(() => {
    return () => {
      twitchRef.current?.disconnect();
      youtubeRef.current?.disconnect();
      kickRef.current?.disconnect();
    };
  }, []);

  const handleToggleTwitch = useCallback(
    (enabled: boolean) => {
      setSettings({ autoConnectTwitch: enabled });
      if (enabled) {
        connectTwitch();
      } else {
        disconnectTwitch();
      }
    },
    [setSettings, connectTwitch, disconnectTwitch]
  );

  const handleToggleYouTube = useCallback(
    (enabled: boolean) => {
      setSettings({ autoConnectYouTube: enabled });
      if (enabled) {
        connectYouTube().catch(() => {});
      } else {
        disconnectYouTube();
      }
    },
    [setSettings, connectYouTube, disconnectYouTube]
  );

  const handleToggleKick = useCallback(
    (enabled: boolean) => {
      setSettings({ autoConnectKick: enabled });
      if (enabled) {
        connectKick();
      } else {
        disconnectKick();
      }
    },
    [setSettings, connectKick, disconnectKick]
  );

  const startTwitchBotLogin = useCallback(async () => {
    return invoke<TwitchDeviceStart>("twitch_oauth_device_start");
  }, []);

  const finishTwitchBotLogin = useCallback(
    async (device: TwitchDeviceStart) => {
      const result = await invoke<TwitchLoginResult>("twitch_oauth_device_poll", {
        deviceCode: device.deviceCode,
        interval: device.interval,
        expiresIn: device.expiresIn,
      });
      console.log(t("log.twitchBotConnected", { username: result.username }));
      setSettings({
        twitchBot: {
          username: result.username,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: Date.now() + result.expiresIn * 1000,
        },
      });
    },
    [setSettings, t]
  );

  const logoutTwitchBot = useCallback(() => {
    console.log(t("log.twitchBotDisconnected"));
    setSettings({ twitchBot: EMPTY_TWITCH_BOT });
    disconnectTwitch();
  }, [setSettings, disconnectTwitch, t]);

  const setYoutubeLiveUrl = useCallback(
    (liveUrl: string) => {
      console.log(t("log.youtubeLiveUrlSet", { url: liveUrl }));
      setSettings({ youtubeConfig: { liveUrl } });
      disconnectYouTube();
    },
    [setSettings, disconnectYouTube, t]
  );

  const loginKickBot = useCallback(async () => {
    const result = await invoke<KickLoginResult>("kick_oauth_login");
    console.log(t("log.kickBotConnected", { username: result.username }));
    setSettings({
      kickBot: {
        username: result.username,
        userId: result.userId,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
      },
    });
  }, [setSettings, t]);

  const logoutKickBot = useCallback(() => {
    console.log(t("log.kickBotDisconnected"));
    setSettings({ kickBot: EMPTY_KICK_BOT });
    disconnectKick();
  }, [setSettings, disconnectKick, t]);

  // announce poll start/end in chat, on any connector currently logged in as a bot.
  // YouTube has no bot account (read-only scrape) so it's never included here.
  function announce(message: string) {
    console.log("[announce]", message, {
      announceInChat: settingsRef.current.announceInChat,
      twitch: !!twitchRef.current,
      kick: !!kickRef.current,
    });
    twitchRef.current?.say(message);
    kickRef.current?.say(message);
  }

  const announcedStartId = useRef<string | null>(null);
  useEffect(() => {
    if (!poll || poll.status !== "active" || announcedStartId.current === poll.id) return;
    announcedStartId.current = poll.id;
    if (!settingsRef.current.announceInChat) return;
    announce(buildPollStartedAnnounce(poll.question, poll.options, t));
  }, [poll, t]);

  const announcedEndId = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResult || announcedEndId.current === lastResult.poll.id) return;
    announcedEndId.current = lastResult.poll.id;
    if (!settingsRef.current.announceInChat) return;
    const winnerText = lastResult.winner
      ? `${lastResult.winner.label} (${lastResult.percentages[lastResult.winner.id]}%)`
      : t("announce.noVotes");
    announce(
      hardTruncate(t("announce.pollEnded", { winner: winnerText, total: lastResult.totalVotes }))
    );
  }, [lastResult, t]);

  return {
    connectTwitch,
    disconnectTwitch,
    connectYouTube,
    disconnectYouTube,
    connectKick,
    disconnectKick,
    handleToggleTwitch,
    handleToggleYouTube,
    handleToggleKick,
    startTwitchBotLogin,
    finishTwitchBotLogin,
    logoutTwitchBot,
    setYoutubeLiveUrl,
    loginKickBot,
    logoutKickBot,
  };
}
