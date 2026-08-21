import { ChatMessage } from "@/lib/poll/types";

interface LiveChatMessageItem {
  id: string;
  snippet: {
    publishedAt: string;
    authorChannelId: string;
    displayMessage: string;
  };
  authorDetails: {
    channelId: string;
    displayName: string;
  };
}

export class YouTubeChatConnector {
  private apiKey: string;
  private videoId: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;

  private liveChatId: string | null = null;
  private nextPageToken: string | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private seenIds = new Set<string>();

  constructor(
    apiKey: string,
    videoId: string,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (s: "disconnected" | "connecting" | "connected" | "error") => void
  ) {
    this.apiKey = apiKey;
    this.videoId = videoId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    this.onStatusChange("connecting");
    try {
      this.liveChatId = await this.fetchLiveChatId();
      this.running = true;
      this.onStatusChange("connected");
      this.schedulePoll(0);
    } catch {
      this.onStatusChange("error");
    }
  }

  private async fetchLiveChatId(): Promise<string> {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${this.videoId}&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("YT video fetch failed");
    const data = await res.json();
    const id: string | undefined = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!id) throw new Error("No active live chat found");
    return id;
  }

  private schedulePoll(delayMs: number) {
    this.timerId = setTimeout(() => this.pollMessages(), delayMs);
  }

  private async pollMessages() {
    if (!this.running || !this.liveChatId) return;

    try {
      let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${this.liveChatId}&part=snippet,authorDetails&key=${this.apiKey}&maxResults=200`;
      if (this.nextPageToken) url += `&pageToken=${this.nextPageToken}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("YT chat fetch failed");
      const data = await res.json();

      this.nextPageToken = data.nextPageToken ?? null;
      const pollingIntervalMs: number = data.pollingIntervalMillis ?? 3000;

      const items: LiveChatMessageItem[] = data.items ?? [];
      for (const item of items) {
        if (this.seenIds.has(item.id)) continue;
        this.seenIds.add(item.id);
        const msg: ChatMessage = {
          platform: "youtube",
          userId: item.snippet.authorChannelId ?? item.authorDetails.channelId,
          username: item.authorDetails.displayName,
          text: item.snippet.displayMessage,
          timestamp: new Date(item.snippet.publishedAt).getTime(),
        };
        this.onMessage(msg);
      }

      // keep seenIds from growing unbounded
      if (this.seenIds.size > 5000) this.seenIds.clear();

      this.schedulePoll(pollingIntervalMs);
    } catch {
      if (this.running) this.schedulePoll(5000); // retry on error
    }
  }

  disconnect() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
    this.liveChatId = null;
    this.nextPageToken = null;
    this.seenIds.clear();
    this.onStatusChange("disconnected");
  }
}
