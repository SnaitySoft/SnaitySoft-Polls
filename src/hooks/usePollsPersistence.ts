"use client";

import { useEffect, useRef, useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { loadPollsData, savePollsData } from "@/lib/polls/persistence";
import { useToastStore } from "@/store/useToastStore";

export function usePollsPersistence() {
  const { templates, history, setPollsData, setPollsDataLoaded } = usePollStore();
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // load on mount
  useEffect(() => {
    loadPollsData()
      .then((saved) => {
        if (Object.keys(saved).length > 0) setPollsData(saved);
      })
      .finally(() => {
        setLoaded(true);
        isFirstLoad.current = false;
        setPollsDataLoaded();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-save with debounce whenever templates/history change (skip first render)
  useEffect(() => {
    if (isFirstLoad.current || !loaded) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      savePollsData({ templates, history }).catch(() => {
        useToastStore.getState().pushToast("Falha ao salvar polls/histórico", "error");
      });
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [templates, history, loaded]);

  return { loaded };
}
