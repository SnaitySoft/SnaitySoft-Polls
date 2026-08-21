import { load, Store } from "@tauri-apps/plugin-store";
import { Settings } from "@/store/usePollStore";

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

    const twitchChannel = await store.get<string>("twitchChannel");
    const ytApiKey = await store.get<string>("ytApiKey");
    const ytVideoId = await store.get<string>("ytVideoId");
    const autoConnectTwitch = await store.get<boolean>("autoConnectTwitch");
    const autoConnectYouTube = await store.get<boolean>("autoConnectYouTube");

    if (twitchChannel) result.twitchChannel = twitchChannel;
    if (ytApiKey) result.ytApiKey = ytApiKey;
    if (ytVideoId) result.ytVideoId = ytVideoId;
    if (autoConnectTwitch != null) result.autoConnectTwitch = autoConnectTwitch;
    if (autoConnectYouTube != null) result.autoConnectYouTube = autoConnectYouTube;

    return result;
  } catch {
    return {};
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  await store.set("twitchChannel", settings.twitchChannel);
  await store.set("ytApiKey", settings.ytApiKey);
  await store.set("ytVideoId", settings.ytVideoId);
  await store.set("autoConnectTwitch", settings.autoConnectTwitch);
  await store.set("autoConnectYouTube", settings.autoConnectYouTube);
  await store.save();
}
