import { create } from "zustand";
import { Poll, PollResult, ChatMessage } from "@/lib/poll/types";
import { createPoll, processVote, endPoll, serializePoll } from "@/lib/poll/engine";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface Settings {
  twitchChannel: string;
  ytApiKey: string;
  ytVideoId: string;
  overlayPort: number;
  autoConnectTwitch: boolean;
  autoConnectYouTube: boolean;
}

interface PollStore {
  poll: Poll | null;
  lastResult: PollResult | null;
  connections: {
    twitch: ConnectionStatus;
    youtube: ConnectionStatus;
  };
  settings: Settings;
  settingsLoaded: boolean;
  chatLog: ChatMessage[];
  onOverlayUpdate: ((json: string) => void) | null;

  // actions
  setSettings: (s: Partial<Settings>) => void;
  setSettingsLoaded: () => void;
  setConnectionStatus: (platform: "twitch" | "youtube", status: ConnectionStatus) => void;
  setOnOverlayUpdate: (cb: (json: string) => void) => void;
  startPoll: (question: string, labels: string[], durationSec: number, uniqueVotes: boolean) => void;
  endCurrentPoll: () => void;
  processMessage: (msg: ChatMessage) => void;
  clearLog: () => void;
}

export const usePollStore = create<PollStore>((set, get) => ({
  poll: null,
  lastResult: null,
  connections: { twitch: "disconnected", youtube: "disconnected" },
  settings: {
    twitchChannel: "",
    ytApiKey: "",
    ytVideoId: "",
    overlayPort: 9898,
    autoConnectTwitch: false,
    autoConnectYouTube: false,
  },
  settingsLoaded: false,
  chatLog: [],
  onOverlayUpdate: null,

  setSettings: (s) =>
    set((state) => ({ settings: { ...state.settings, ...s } })),

  setSettingsLoaded: () => set({ settingsLoaded: true }),

  setConnectionStatus: (platform, status) =>
    set((state) => ({
      connections: { ...state.connections, [platform]: status },
    })),

  setOnOverlayUpdate: (cb) => set({ onOverlayUpdate: cb }),

  startPoll: (question, labels, durationSec, uniqueVotes) => {
    const poll = createPoll(question, labels, durationSec, uniqueVotes);
    set({ poll, lastResult: null });
    get().onOverlayUpdate?.(JSON.stringify({ type: "poll_update", data: serializePoll(poll) }));
  },

  endCurrentPoll: () => {
    const { poll } = get();
    if (!poll) return;
    const result = endPoll(poll);
    set({ poll: { ...poll, status: "ended" }, lastResult: result });
    get().onOverlayUpdate?.(
      JSON.stringify({ type: "poll_ended", data: { ...serializePoll(poll), result } })
    );
  },

  processMessage: (msg) => {
    const { poll } = get();

    set((state) => ({
      chatLog: [msg, ...state.chatLog].slice(0, 100),
    }));

    if (!poll || poll.status !== "active") return;

    const { voted, updatedOptions } = processVote(poll, msg.userId, msg.text);
    if (voted) {
      const updatedPoll = { ...poll, options: updatedOptions };
      set({ poll: updatedPoll });
      get().onOverlayUpdate?.(
        JSON.stringify({ type: "poll_update", data: serializePoll(updatedPoll) })
      );
    }
  },

  clearLog: () => set({ chatLog: [] }),
}));
