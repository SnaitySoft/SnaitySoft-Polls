import { create } from "zustand";
import { Poll, PollResult, PollTemplate, ChatMessage } from "@/lib/poll/types";
import { createPoll, processVote, endPoll, serializePoll } from "@/lib/poll/engine";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type ChatPlatform = "twitch" | "youtube" | "kick";

export interface TwitchBotAuth {
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

// YouTube reading has no OAuth login — it scrapes the live chat straight from the pasted
// live URL/ID, so there's no bot account or token to manage, just this one config field.
export interface YouTubeConfig {
  liveUrl: string;
}

export interface KickBotAuth {
  username: string;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export const EMPTY_TWITCH_BOT: TwitchBotAuth = {
  username: "",
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
};

export const EMPTY_YOUTUBE_CONFIG: YouTubeConfig = {
  liveUrl: "",
};

export const EMPTY_KICK_BOT: KickBotAuth = {
  username: "",
  userId: 0,
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
};

export interface Settings {
  overlayPort: number;
  autoConnectTwitch: boolean;
  autoConnectYouTube: boolean;
  autoConnectKick: boolean;
  announceInChat: boolean;
  maxPollOptions: number;
  autoClearDelay: number; // seconds after a poll ends before preview/overlay auto-clear; 0 = never
  twitchBot: TwitchBotAuth;
  youtubeConfig: YouTubeConfig;
  kickBot: KickBotAuth;
}

export const DEFAULT_SETTINGS: Settings = {
  overlayPort: 9898,
  autoConnectTwitch: false,
  autoConnectYouTube: false,
  autoConnectKick: false,
  announceInChat: true,
  maxPollOptions: 10,
  autoClearDelay: 0,
  twitchBot: EMPTY_TWITCH_BOT,
  youtubeConfig: EMPTY_YOUTUBE_CONFIG,
  kickBot: EMPTY_KICK_BOT,
};

interface PollStore {
  poll: Poll | null;
  lastResult: PollResult | null;
  templates: PollTemplate[];
  history: PollResult[];
  connections: {
    twitch: ConnectionStatus;
    youtube: ConnectionStatus;
    kick: ConnectionStatus;
  };
  settings: Settings;
  settingsLoaded: boolean;
  pollsDataLoaded: boolean;
  chatLog: ChatMessage[];
  onOverlayUpdate: ((json: string) => void) | null;

  // actions
  setSettings: (s: Partial<Settings>) => void;
  setSettingsLoaded: () => void;
  setPollsData: (data: { templates?: PollTemplate[]; history?: PollResult[] }) => void;
  setPollsDataLoaded: () => void;
  setConnectionStatus: (platform: ChatPlatform, status: ConnectionStatus) => void;
  setOnOverlayUpdate: (cb: (json: string) => void) => void;
  startPoll: (question: string, labels: string[], durationSec: number, uniqueVotes: boolean) => void;
  endCurrentPoll: () => void;
  clearCurrentPoll: () => void;
  processMessage: (msg: ChatMessage) => void;
  clearLog: () => void;
  saveTemplate: (template: Omit<PollTemplate, "id" | "createdAt">) => void;
  deleteTemplate: (id: string) => void;
  deleteHistoryEntry: (pollId: string) => void;
  clearHistory: () => void;
  resetAllData: () => void;
}

let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAutoClear() {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
}

export const usePollStore = create<PollStore>((set, get) => ({
  poll: null,
  lastResult: null,
  templates: [],
  history: [],
  connections: { twitch: "disconnected", youtube: "disconnected", kick: "disconnected" },
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  pollsDataLoaded: false,
  chatLog: [],
  onOverlayUpdate: null,

  setSettings: (s) =>
    set((state) => ({ settings: { ...state.settings, ...s } })),

  setSettingsLoaded: () => set({ settingsLoaded: true }),

  setPollsData: (data) =>
    set((state) => ({
      templates: data.templates ?? state.templates,
      history: data.history ?? state.history,
    })),

  setPollsDataLoaded: () => set({ pollsDataLoaded: true }),

  setConnectionStatus: (platform, status) =>
    set((state) => ({
      connections: { ...state.connections, [platform]: status },
    })),

  setOnOverlayUpdate: (cb) => set({ onOverlayUpdate: cb }),

  startPoll: (question, labels, durationSec, uniqueVotes) => {
    cancelAutoClear();
    const poll = createPoll(question, labels, durationSec, uniqueVotes);
    set({ poll, lastResult: null });
    get().onOverlayUpdate?.(JSON.stringify({ type: "poll_update", data: serializePoll(poll) }));
  },

  endCurrentPoll: () => {
    const { poll } = get();
    if (!poll) return;
    const result = endPoll(poll);
    set((state) => ({
      poll: { ...poll, status: "ended" },
      lastResult: result,
      history: [result, ...state.history].slice(0, 200),
    }));
    get().onOverlayUpdate?.(
      JSON.stringify({ type: "poll_ended", data: { ...serializePoll(poll), result } })
    );

    cancelAutoClear();
    const delay = get().settings.autoClearDelay;
    if (delay > 0) {
      autoClearTimer = setTimeout(() => get().clearCurrentPoll(), delay * 1000);
    }
  },

  clearCurrentPoll: () => {
    cancelAutoClear();
    set({ poll: null, lastResult: null });
    get().onOverlayUpdate?.(JSON.stringify({ type: "poll_cleared", data: null }));
  },

  processMessage: (msg) => {
    const { poll } = get();

    set((state) => ({
      chatLog: [msg, ...state.chatLog].slice(0, 100),
    }));

    if (!poll || poll.status !== "active") return;

    const wasDuplicate = poll.uniqueVotes && poll.voters.has(msg.userId);
    const { voted, updatedOptions } = processVote(poll, msg.userId, msg.text);
    console.log("[vote]", {
      platform: msg.platform,
      userId: msg.userId,
      username: msg.username,
      text: msg.text,
      voted,
      rejectedAsDuplicate: wasDuplicate,
    });
    if (voted) {
      const updatedPoll = { ...poll, options: updatedOptions };
      set({ poll: updatedPoll });
      get().onOverlayUpdate?.(
        JSON.stringify({ type: "poll_update", data: serializePoll(updatedPoll) })
      );
    }
  },

  clearLog: () => set({ chatLog: [] }),

  saveTemplate: (template) =>
    set((state) => ({
      templates: [
        { ...template, id: `tpl-${Date.now()}`, createdAt: Date.now() },
        ...state.templates,
      ],
    })),

  deleteTemplate: (id) =>
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

  deleteHistoryEntry: (pollId) =>
    set((state) => ({ history: state.history.filter((h) => h.poll.id !== pollId) })),

  clearHistory: () => set({ history: [] }),

  resetAllData: () => set({ settings: DEFAULT_SETTINGS, templates: [], history: [] }),
}));
