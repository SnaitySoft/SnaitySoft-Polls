"use client";

import { useEffect, useRef } from "react";
import { usePollStore } from "@/store/usePollStore";
import { invoke } from "@tauri-apps/api/core";
import { serializePoll } from "@/lib/poll/engine";

export function useOverlaySync() {
  const { poll, lastResult, setOnOverlayUpdate } = usePollStore();
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    // register the callback once
    setOnOverlayUpdate(async (json: string) => {
      try {
        await invoke("update_overlay", { json });
      } catch {
        // Tauri not available (browser dev mode)
      }
    });
  }, [setOnOverlayUpdate]);

  // sync on mount if poll is already active
  useEffect(() => {
    if (!poll) return;
    const json = JSON.stringify({ type: "poll_update", data: serializePoll(poll) });
    invoke("update_overlay", { json }).catch(() => {});
  }, [poll?.id]); // only re-sync when poll identity changes

  void lastResult; // consumed upstream
}
