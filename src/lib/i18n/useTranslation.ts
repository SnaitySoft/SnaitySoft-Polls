import { useCallback } from "react";
import { usePollStore, Locale } from "@/store/usePollStore";
import { pt, TranslationKey } from "./pt";
import { en } from "./en";

const dictionaries = { pt, en };

/// Only meaningful the first time the app runs (no saved locale yet) — see where this is
/// called in useSettingsPersistence.ts. Reads navigator.language, which WebView2 reflects
/// from the OS UI language by default; Portuguese (any region — "pt", "pt-BR", "pt-PT")
/// picks "pt", everything else picks "en". Must only ever run client-side: `navigator`
/// doesn't exist during Next.js's static-export prerendering pass in Node.
export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = (navigator.language || navigator.languages?.[0] || "").toLowerCase();
  return lang.startsWith("pt") ? "pt" : "en";
}

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let out = template;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/// For non-React modules (chat connectors, token refresh helpers) that can't call a hook but
/// still need to log human-readable, locale-aware diagnostic messages — reads the current
/// locale fresh from the store each call rather than subscribing, which is fine for one-off
/// log statements (not for rendering UI, where useTranslation's reactive `t` is correct).
export function translate(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = usePollStore.getState().settings.locale;
  const dict = dictionaries[locale];
  return format(dict[key] ?? pt[key] ?? key, params);
}

export function useTranslation() {
  const locale = usePollStore((s) => s.settings.locale);
  const dict = dictionaries[locale];

  // Memoized so `t` keeps a stable identity across renders as long as locale doesn't
  // change — dict itself is a stable module-level object per locale, so this only
  // produces a new function when the user actually switches language. Without this,
  // `t` was a fresh function every render, and including it in a useEffect dependency
  // array (as several hooks do, since they call t() inside the effect) made those
  // effects re-fire on every unrelated render — e.g. permanently stuck on "Saving…"
  // because the settings-save effect kept resetting itself before its debounce timer
  // could ever complete.
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return format(dict[key] ?? pt[key] ?? key, params);
    },
    [dict]
  );

  return { t, locale };
}

/// Backend commands (Rust) return either a plain human-readable string (for passthrough
/// errors like raw HTTP bodies — deliberately not localized, see error handling notes) or a
/// translation key with "|"-separated positional params (e.g. "error.env_var_missing|TWITCH_CLIENT_ID").
/// Unknown keys fall through to the raw string unchanged.
export function translateBackendError(raw: string, locale: "pt" | "en"): string {
  const [key, ...params] = raw.split("|");
  const dict = dictionaries[locale] as Record<string, string>;
  const template = dict[key] ?? (pt as Record<string, string>)[key];
  if (!template) return raw;
  let out = template;
  params.forEach((p, i) => {
    out = out.replaceAll(`{${i}}`, p);
  });
  return out;
}

/// Tauri command errors (Result::Err(String) on the Rust side) arrive as a plain string
/// rejection, not an Error instance. Use this everywhere a caught error needs to be shown
/// to the user, so both the translation-key protocol and plain Error/unknown values resolve
/// to something sensible instead of leaking [object Object] or an untranslated key.
export function useErrorMessage() {
  const { t, locale } = useTranslation();
  return (e: unknown): string => {
    if (typeof e === "string") return translateBackendError(e, locale);
    if (e instanceof Error) return e.message;
    return t("error.generic");
  };
}
