import { invoke } from "@tauri-apps/api/core";
import { ChatMessage } from "@/lib/poll/types";

interface YoutubeScrapeStart {
  apiKey: string;
  clientVersion: string;
  continuation: string;
}

interface YoutubeScrapedMessage {
  id: string;
  authorName: string;
  authorChannelId: string;
  text: string;
  timestampMs: number;
}

interface YoutubeScrapePoll {
  messages: YoutubeScrapedMessage[];
  continuation: string;
}

// Reads chat via YouTube's internal "innertube" endpoint (the same one youtube.com's own web
// player calls) instead of the official Data API v3 — the official liveChatMessages.list call
// charges quota per request and exhausts the free 10k/day tier in a couple hours of continuous
// polling. This is unofficial/undocumented and could change without notice. There's no OAuth
// bot account involved and no way to post messages — this connector is read-only by design.
export class YouTubeChatConnector {
  private liveUrl: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;

  private apiKey: string | null = null;
  private clientVersion: string | null = null;
  private continuation: string | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private seenIds = new Set<string>();
  // the initial continuation from the live page includes a backlog of recent messages
  // (same ones a viewer sees when opening chat) — drop anything older than connect time
  // so only new messages surface, matching what other platforms' connectors already do.
  private connectedAtMs = 0;

  constructor(
    liveUrl: string,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (s: "disconnected" | "connecting" | "connected" | "error") => void
  ) {
    this.liveUrl = liveUrl;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    this.onStatusChange("connecting");
    try {
      if (!this.liveUrl) throw new Error("no live url configured");
      const start = await invoke<YoutubeScrapeStart>("youtube_scrape_start", {
        liveUrl: this.liveUrl,
      });
      this.apiKey = start.apiKey;
      this.clientVersion = start.clientVersion;
      this.continuation = start.continuation;
      this.connectedAtMs = Date.now();

      this.running = true;
      this.onStatusChange("connected");
      this.schedulePoll(0);
    } catch (e) {
      console.error("[youtube] falha ao conectar:", e);
      this.onStatusChange("error");
    }
  }

  private schedulePoll(delayMs: number) {
    this.timerId = setTimeout(() => this.pollMessages(), delayMs);
  }

  private async pollMessages() {
    if (!this.running || !this.apiKey || !this.clientVersion || !this.continuation) return;

    try {
      const result = await invoke<YoutubeScrapePoll>("youtube_scrape_poll", {
        apiKey: this.apiKey,
        clientVersion: this.clientVersion,
        continuation: this.continuation,
      });

      this.continuation = result.continuation;

      for (const item of result.messages) {
        if (this.seenIds.has(item.id)) continue;
        this.seenIds.add(item.id);
        if (item.timestampMs < this.connectedAtMs) continue;
        const msg: ChatMessage = {
          platform: "youtube",
          userId: item.authorChannelId,
          username: item.authorName,
          text: item.text,
          timestamp: item.timestampMs,
        };
        this.onMessage(msg);
      }

      // keep seenIds from growing unbounded
      if (this.seenIds.size > 5000) this.seenIds.clear();

      this.schedulePoll(3000);
    } catch (e) {
      console.error("[youtube] falha ao buscar mensagens do chat (scrape):", e);
      if (this.running) this.schedulePoll(5000); // retry on error
    }
  }

  disconnect() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
    this.apiKey = null;
    this.clientVersion = null;
    this.continuation = null;
    this.connectedAtMs = 0;
    this.seenIds.clear();
    this.onStatusChange("disconnected");
  }
}
