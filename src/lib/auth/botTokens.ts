import { invoke } from "@tauri-apps/api/core";
import { usePollStore } from "@/store/usePollStore";
import { translate } from "@/lib/i18n/useTranslation";

const REFRESH_MARGIN_MS = 60_000;

interface RefreshResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export async function getValidTwitchBotToken(): Promise<string | null> {
  const { settings, setSettings } = usePollStore.getState();
  const bot = settings.twitchBot;
  if (!bot.refreshToken) return null;
  if (bot.accessToken && bot.expiresAt - REFRESH_MARGIN_MS > Date.now()) return bot.accessToken;

  try {
    const result = await invoke<RefreshResult>("twitch_oauth_refresh", {
      refreshToken: bot.refreshToken,
    });
    const updated = {
      ...bot,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? bot.refreshToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
    };
    setSettings({ twitchBot: updated });
    return updated.accessToken;
  } catch {
    return null;
  }
}

export async function getValidKickBotToken(): Promise<string | null> {
  const { settings, setSettings } = usePollStore.getState();
  const bot = settings.kickBot;
  if (!bot.refreshToken) return null;
  if (bot.accessToken && bot.expiresAt - REFRESH_MARGIN_MS > Date.now()) return bot.accessToken;

  try {
    const result = await invoke<RefreshResult>("kick_oauth_refresh", {
      refreshToken: bot.refreshToken,
    });
    const updated = {
      ...bot,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? bot.refreshToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
    };
    setSettings({ kickBot: updated });
    return updated.accessToken;
  } catch (e) {
    console.error(translate("log.kickTokenRefreshFailed"), e);
    return null;
  }
}
