"use client";

import { useEffect, useState } from "react";
import { OverlayView } from "@/components/overlay/OverlayView";
import { PollOption } from "@/lib/poll/types";

interface OverlayData {
  question: string;
  options: PollOption[];
  status: string;
  endsAt: number;
  totalVoters: number;
}

interface WsPayload {
  type: "poll_update" | "poll_ended";
  data: OverlayData;
}

export default function OverlayPage() {
  const [data, setData] = useState<OverlayData | null>(null);

  useEffect(() => {
    const port = 9898;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      if (stopped) return;

      ws = new WebSocket(`ws://localhost:${port}/ws`);

      ws.onmessage = (e) => {
        try {
          const payload: WsPayload = JSON.parse(e.data);
          setData(payload.data);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!stopped) {
          retryTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      stopped = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
      ws = null;
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent p-4 flex items-start justify-center">
      <div className="w-full max-w-md mt-8">
        <OverlayView data={data} transparent />
      </div>
    </div>
  );
}
