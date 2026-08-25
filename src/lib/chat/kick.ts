import { ChatMessage } from "@/lib/poll/types";
import { translate } from "@/lib/i18n/useTranslation";

// Kick's official API only delivers incoming chat messages via webhooks, which need a
// public HTTPS URL — not viable for a local desktop app. Reading instead uses the same
// public Pusher WebSocket kick.com's own site connects to. This is unofficial and could
// change without notice; if it stops working, that's the first place to look.
const PUSHER_WS_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false";
const RECONNECT_DELAY_MS = 3000;

interface KickChatMessagePayload {
  id: string;
  content: string;
  created_at?: string;
  sender?: { id: number; username: string };
  user?: { id: number; username: string };
}

export class KickChatConnector {
  private username: string;
  private broadcasterUserId: number;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  private getAccessToken: () => Promise<string | null>;

  private ws: WebSocket | null = null;
  private chatroomId: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    username: string,
    broadcasterUserId: number,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (s: "disconnected" | "connecting" | "connected" | "error") => void,
    getAccessToken: () => Promise<string | null>
  ) {
    this.username = username.toLowerCase();
    this.broadcasterUserId = broadcasterUserId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.getAccessToken = getAccessToken;
  }

  async connect() {
    this.stopped = false;
    this.onStatusChange("connecting");
    try {
      this.chatroomId = await this.fetchChatroomId();
      this.openSocket();
    } catch {
      this.onStatusChange("error");
    }
  }

  private async fetchChatroomId(): Promise<number> {
    const res = await fetch(`https://kick.com/api/v2/channels/${this.username}`);
    if (!res.ok) throw new Error("Kick channel fetch failed");
    const data = await res.json();
    const id: number | undefined = data?.chatroom?.id;
    if (!id) throw new Error("Kick chatroom not found");
    return id;
  }

  private openSocket() {
    if (this.stopped || !this.chatroomId) return;

    const ws = new WebSocket(PUSHER_WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      // Kick's site itself subscribes to several variants of this channel name, but only
      // the ".v2" one actually carries ChatMessageEvent — confirmed by sniffing kick.com's
      // own WebSocket traffic directly, since third-party docs for this got it wrong.
      ws.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: { channel: `chatrooms.${this.chatroomId}.v2` },
        })
      );
      this.onStatusChange("connected");
    };

    ws.onmessage = (evt) => {
      try {
        const outer = JSON.parse(evt.data);
        if (outer.event !== "App\\Events\\ChatMessageEvent") return;

        const payload: KickChatMessagePayload = JSON.parse(outer.data);
        const sender = payload.sender ?? payload.user;
        if (!sender) return;

        const msg: ChatMessage = {
          platform: "kick",
          userId: String(sender.id),
          username: sender.username,
          text: payload.content,
          timestamp: payload.created_at ? new Date(payload.created_at).getTime() : Date.now(),
        };
        this.onMessage(msg);
      } catch {
        // not a chat message frame (ping, subscription ack, etc.) — ignore
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.stopped) return;
      this.onStatusChange("disconnected");
      this.reconnectTimer = setTimeout(() => this.openSocket(), RECONNECT_DELAY_MS);
    };
  }

  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.chatroomId = null;
    this.onStatusChange("disconnected");
  }

  async say(message: string) {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        console.error(translate("log.kickSayNoToken"));
        return;
      }

      const res = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
          type: "user",
          broadcaster_user_id: this.broadcasterUserId,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          translate("log.kickSayHttpError", { status: res.status, statusText: res.statusText, body })
        );
      }
    } catch (e) {
      // best-effort — chat announcement failures shouldn't break the poll flow
      console.error(translate("log.kickSayException"), e);
    }
  }
}
