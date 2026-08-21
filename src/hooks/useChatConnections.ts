"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePollStore } from "@/store/usePollStore";
import { TwitchChatConnector } from "@/lib/chat/twitch";
import { YouTubeChatConnector } from "@/lib/chat/youtube";

export interface ChatConnectionActions {
  connectTwitch: () => void;
  disconnectTwitch: () => void;
  connectYouTube: () => void;
  disconnectYouTube: () => void;
  handleToggleTwitch: (enabled: boolean) => void;
  handleToggleYouTube: (enabled: boolean) => void;
}

export function useChatConnections(): ChatConnectionActions {
  const { settings, settingsLoaded, setSettings, setConnectionStatus, processMessage } =
    usePollStore();

  const twitchRef = useRef<TwitchChatConnector | null>(null);
  const youtubeRef = useRef<YouTubeChatConnector | null>(null);

  // keep a ref to the latest settings so callbacks don't go stale
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const connectTwitch = useCallback(async () => {
    const { twitchChannel } = settingsRef.current;
    if (!twitchChannel) return;
    twitchRef.current?.disconnect();
    const conn = new TwitchChatConnector(
      twitchChannel,
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
    const { ytApiKey, ytVideoId } = settingsRef.current;
    if (!ytApiKey || !ytVideoId) return;
    youtubeRef.current?.disconnect();
    const conn = new YouTubeChatConnector(
      ytApiKey,
      ytVideoId,
      processMessage,
      (s) => setConnectionStatus("youtube", s)
    );
    youtubeRef.current = conn;
    await conn.connect();
  }, [processMessage, setConnectionStatus]);

  const disconnectYouTube = useCallback(() => {
    youtubeRef.current?.disconnect();
    youtubeRef.current = null;
  }, []);

  // auto-connect once after settings are loaded from disk
  useEffect(() => {
    if (!settingsLoaded) return;
    const { autoConnectTwitch, twitchChannel, autoConnectYouTube, ytApiKey, ytVideoId } =
      settingsRef.current;
    if (autoConnectTwitch && twitchChannel) connectTwitch();
    if (autoConnectYouTube && ytApiKey && ytVideoId) connectYouTube();
  }, [settingsLoaded, connectTwitch, connectYouTube]);

  // cleanup only when app unmounts (not on tab switch)
  useEffect(() => {
    return () => {
      twitchRef.current?.disconnect();
      youtubeRef.current?.disconnect();
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
        connectYouTube();
      } else {
        disconnectYouTube();
      }
    },
    [setSettings, connectYouTube, disconnectYouTube]
  );

  return {
    connectTwitch,
    disconnectTwitch,
    connectYouTube,
    disconnectYouTube,
    handleToggleTwitch,
    handleToggleYouTube,
  };
}
