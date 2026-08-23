import { load, Store } from "@tauri-apps/plugin-store";
import { Settings, TwitchBotAuth, YouTubeConfig, KickBotAuth } from "@/store/usePollStore";

const STORE_FILE = "settings.json";

let _store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!_store) _store = await load(STORE_FILE, { autoSave: false });
  return _store;
}

export async function loadSettings(): Promise<Partial<Settings>> {
  try {
    const store = await getStore();
    const result: Partial<Settings> = {};

    const autoConnectTwitch = await store.get<boolean>("autoConnectTwitch");
    const autoConnectYouTube = await store.get<boolean>("autoConnectYouTube");
    const autoConnectKick = await store.get<boolean>("autoConnectKick");
    const announceInChat = await store.get<boolean>("announceInChat");
    const maxPollOptions = await store.get<number>("maxPollOptions");
    const autoClearDelay = await store.get<number>("autoClearDelay");
    const twitchBot = await store.get<TwitchBotAuth>("twitchBot");
    const youtubeConfig = await store.get<YouTubeConfig>("youtubeConfig");
    const kickBot = await store.get<KickBotAuth>("kickBot");

    if (autoConnectTwitch != null) result.autoConnectTwitch = autoConnectTwitch;
    if (autoConnectYouTube != null) result.autoConnectYouTube = autoConnectYouTube;
    if (autoConnectKick != null) result.autoConnectKick = autoConnectKick;
    if (announceInChat != null) result.announceInChat = announceInChat;
    if (maxPollOptions != null) result.maxPollOptions = maxPollOptions;
    if (autoClearDelay != null) result.autoClearDelay = autoClearDelay;
    if (twitchBot) result.twitchBot = twitchBot;
    if (youtubeConfig) result.youtubeConfig = youtubeConfig;
    if (kickBot) result.kickBot = kickBot;

    return result;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  await store.set("autoConnectTwitch", settings.autoConnectTwitch);
  await store.set("autoConnectYouTube", settings.autoConnectYouTube);
  await store.set("autoConnectKick", settings.autoConnectKick);
  await store.set("announceInChat", settings.announceInChat);
  await store.set("maxPollOptions", settings.maxPollOptions);
  await store.set("autoClearDelay", settings.autoClearDelay);
  await store.set("twitchBot", settings.twitchBot);
  await store.set("youtubeConfig", settings.youtubeConfig);
  await store.set("kickBot", settings.kickBot);
  await store.save();
}
