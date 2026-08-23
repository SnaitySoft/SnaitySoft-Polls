import { load, Store } from "@tauri-apps/plugin-store";
import { PollTemplate, PollResult } from "@/lib/poll/types";

const STORE_FILE = "polls-data.json";

let _store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!_store) _store = await load(STORE_FILE, { autoSave: false });
  return _store;
}

export interface PollsData {
  templates: PollTemplate[];
  history: PollResult[];
}

export async function loadPollsData(): Promise<Partial<PollsData>> {
  try {
    const store = await getStore();
    const result: Partial<PollsData> = {};

    const templates = await store.get<PollTemplate[]>("templates");
    const history = await store.get<PollResult[]>("history");

    if (templates) result.templates = templates;
    if (history) result.history = history;

    return result;
  } catch {
    return {};
  }
}

export async function savePollsData(data: PollsData): Promise<void> {
  const store = await getStore();
  await store.set("templates", data.templates);
  await store.set("history", data.history);
  await store.save();
}
