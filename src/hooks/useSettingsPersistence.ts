"use client";

import { useEffect, useRef, useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { loadSettings, saveSettings } from "@/lib/settings/persistence";
import { useToastStore } from "@/store/useToastStore";
import { useTranslation, translate, detectSystemLocale } from "@/lib/i18n/useTranslation";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useSettingsPersistence() {
  const { t } = useTranslation();
  const { settings, setSettings, setSettingsLoaded } = usePollStore();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // load on mount
  useEffect(() => {
    loadSettings()
      .then((saved) => {
        // No saved locale (fresh install, or an older settings.json from before locale
        // existed) — detect it from the OS instead of silently keeping the hardcoded "pt"
        // default. Merged in unconditionally so this also covers a truly empty store (saved
        // === {}), which the old `if (Object.keys(saved).length > 0)` guard would've skipped
        // entirely, never giving detection a chance to run.
        const merged = saved.locale ? saved : { ...saved, locale: detectSystemLocale() };
        setSettings(merged);
        // translate(), not t() — t's closure was captured at mount, before this async load
        // resolved and (possibly) changed the locale; translate() reads the store fresh, so
        // it reflects the just-loaded locale instead of always printing in the previous one.
        console.log(translate("log.settingsLoaded", { count: Object.keys(merged).length }));
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
        useToastStore.getState().pushToast(t("toast.falhaSalvarConfiguracoes"), "error");
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings, loaded, t]);

  return { loaded, status };
}

export function useSaveStatus(status: SaveStatus) {
  const { t } = useTranslation();
  if (status === "saving") return { label: t("settings.saveStatusSaving"), color: "text-zinc-400" };
  if (status === "saved") return { label: t("settings.saveStatusSaved"), color: "text-green-400" };
  if (status === "error") return { label: t("settings.saveStatusError"), color: "text-red-400" };
  return { label: "", color: "" };
}
