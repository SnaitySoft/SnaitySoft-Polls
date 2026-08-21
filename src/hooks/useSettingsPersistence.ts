"use client";

import { useEffect, useRef, useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { loadSettings, saveSettings } from "@/lib/settings/persistence";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSettingsPersistence() {
  const { settings, setSettings, setSettingsLoaded } = usePollStore();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // load on mount
  useEffect(() => {
    loadSettings()
      .then((saved) => {
        if (Object.keys(saved).length > 0) setSettings(saved);
      })
      .finally(() => {
        setLoaded(true);
        isFirstLoad.current = false;
        setSettingsLoaded();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-save with debounce whenever settings change (skip first render)
  useEffect(() => {
    if (isFirstLoad.current || !loaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setStatus("saving");

    debounceRef.current = setTimeout(async () => {
      try {
        await saveSettings(settings);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2000);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, loaded]);

  return { loaded, status };
}

export function useSaveStatus(status: SaveStatus) {
  if (status === "saving") return { label: "Salvando…", color: "text-zinc-400" };
  if (status === "saved") return { label: "Salvo", color: "text-green-400" };
  if (status === "error") return { label: "Erro ao salvar", color: "text-red-400" };
  return { label: "", color: "" };
}
