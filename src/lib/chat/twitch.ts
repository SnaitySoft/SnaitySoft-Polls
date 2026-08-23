import type * as TmiTypes from "tmi.js";
import { ChatMessage } from "@/lib/poll/types";

export interface TwitchBotIdentity {
  username: string;
  accessToken: string;
}

export class TwitchChatConnector {
  private client: TmiTypes.Client | null = null;
  private channel: string;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  private botIdentity: TwitchBotIdentity;

  constructor(
    botIdentity: TwitchBotIdentity,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (s: "disconnected" | "connecting" | "connected" | "error") => void
  ) {
    this.channel = botIdentity.username.toLowerCase();
    this.botIdentity = botIdentity;
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
      identity: { username: this.botIdentity.username, password: `oauth:${this.botIdentity.accessToken}` },
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

  async say(message: string) {
    if (!this.client) return;
    try {
      await this.client.say(this.channel, message);
    } catch {
      // best-effort — chat announcement failures shouldn't break the poll flow
    }
  }
}
