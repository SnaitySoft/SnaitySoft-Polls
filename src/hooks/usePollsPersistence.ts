"use client";

import { useEffect, useRef, useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { loadPollsData, savePollsData } from "@/lib/polls/persistence";
import { useToastStore } from "@/store/useToastStore";
import { useTranslation, translate } from "@/lib/i18n/useTranslation";

export function usePollsPersistence() {
  const { t } = useTranslation();
  const { templates, history, setPollsData, setPollsDataLoaded, settingsLoaded } = usePollStore();
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Waits for useSettingsPersistence to finish loading first (assumes it's mounted
  // alongside this hook, which it always is in app/page.tsx) — locale lives in settings,
  // and this hook's own startup log line needs it to already be correct rather than racing
  // against settings' own load and printing in whatever locale happened to be active first.
  useEffect(() => {
    if (!settingsLoaded) return;
    loadPollsData()
      .then((saved) => {
        if (Object.keys(saved).length > 0) setPollsData(saved);
        // translate(), not t() — same reasoning as useSettingsPersistence: this runs in an
        // async callback whose t() closure predates both this load and settings' own load
        // (which is what actually sets the locale), so it can't reliably reflect it.
        console.log(
          translate("log.pollsDataLoaded", {
            templates: saved.templates?.length ?? 0,
            history: saved.history?.length ?? 0,
          })
        );
      })
      .finally(() => {
        setLoaded(true);
        isFirstLoad.current = false;
        setPollsDataLoaded();
      });
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-save with debounce whenever templates/history change (skip first render)
  useEffect(() => {
    if (isFirstLoad.current || !loaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      savePollsData({ templates, history }).catch(() => {
        useToastStore.getState().pushToast(t("toast.falhaSalvarPolls"), "error");
      });
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [templates, history, loaded, t]);

  return { loaded };
}
