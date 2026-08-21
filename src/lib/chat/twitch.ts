import type * as TmiTypes from "tmi.js";
import { ChatMessage } from "@/lib/poll/types";

export class TwitchChatConnector {
  private client: TmiTypes.Client | null = null;
  private channel: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;

  constructor(
    channel: string,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (s: "disconnected" | "connecting" | "connected" | "error") => void
  ) {
    this.channel = channel.toLowerCase().replace(/^#/, "");
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    // lazy-load tmi.js (client-side only)
    const tmi = await import("tmi.js");
    this.onStatusChange("connecting");

    this.client = new tmi.Client({
      channels: [this.channel],
      connection: { reconnect: true, secure: true },
    });

    this.client.on("message", (_channel, tags, text, self) => {
      if (self) return;
      const msg: ChatMessage = {
        platform: "twitch",
        userId: tags["user-id"] ?? tags.username ?? "anon",
        username: tags["display-name"] ?? tags.username ?? "anon",
        text,
        timestamp: Date.now(),
      };
      this.onMessage(msg);
    });

    this.client.on("connected", () => this.onStatusChange("connected"));
    this.client.on("disconnected", () => this.onStatusChange("disconnected"));

    try {
      await this.client.connect();
    } catch {
      this.onStatusChange("error");
    }
  }

  async disconnect() {
    await this.client?.disconnect();
    this.client = null;
    this.onStatusChange("disconnected");
  }
}
