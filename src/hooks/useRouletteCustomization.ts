import { useEffect, useState } from "react";
import {
  WheelThemeKey,
  WheelSizeKey,
  DEFAULT_WHEEL_THEME,
  DEFAULT_SPIN_DURATION_MS,
  DEFAULT_WHEEL_SIZE,
  DEFAULT_SOUND_ENABLED,
  DEFAULT_SOUND_VOLUME,
  WHEEL_THEMES,
  WHEEL_SIZE_OPTIONS,
  CUSTOM_THEME_DEFAULT_COLORS,
} from "@/lib/roulette/engine";

const STORAGE_KEY = "roulette-customization";

interface StoredCustomization {
  theme: WheelThemeKey;
  customColors: string[];
  durationMs: number;
  showLabels: boolean;
  wheelSize: WheelSizeKey;
  soundEnabled: boolean;
  soundVolume: number;
}

const DEFAULTS: StoredCustomization = {
  theme: DEFAULT_WHEEL_THEME,
  customColors: CUSTOM_THEME_DEFAULT_COLORS,
  durationMs: DEFAULT_SPIN_DURATION_MS,
  showLabels: true,
  wheelSize: DEFAULT_WHEEL_SIZE,
  soundEnabled: DEFAULT_SOUND_ENABLED,
  soundVolume: DEFAULT_SOUND_VOLUME,
};

function isValidTheme(v: unknown): v is WheelThemeKey {
  return v === "custom" || (typeof v === "string" && v in WHEEL_THEMES);
}

function isValidSize(v: unknown): v is WheelSizeKey {
  return typeof v === "string" && WHEEL_SIZE_OPTIONS.some((o) => o.key === v);
}

// Reads synchronously so useState's lazy initializer can pick it up on the very first render —
// no mount effect needed, so there's no flash of default values before the stored ones apply.
// Throws (and falls back to defaults) during Next.js's static-export prerendering pass in Node,
// same as useTranslation's detectSystemLocale, since `localStorage` doesn't exist there either.
function readStored(): StoredCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredCustomization>;
    return {
      theme: isValidTheme(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      customColors:
        Array.isArray(parsed.customColors) && parsed.customColors.every((c) => typeof c === "string")
          ? parsed.customColors
          : DEFAULTS.customColors,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : DEFAULTS.durationMs,
      showLabels: typeof parsed.showLabels === "boolean" ? parsed.showLabels : DEFAULTS.showLabels,
      wheelSize: isValidSize(parsed.wheelSize) ? parsed.wheelSize : DEFAULTS.wheelSize,
      soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : DEFAULTS.soundEnabled,
      soundVolume:
        typeof parsed.soundVolume === "number" && parsed.soundVolume >= 0 && parsed.soundVolume <= 100
          ? parsed.soundVolume
          : DEFAULTS.soundVolume,
    };
  } catch {
    return DEFAULTS;
  }
}

// Purely a decorative per-device preference (which colors/speed/size the wheel uses) — kept in
// localStorage rather than the app's Tauri-backed Settings store, since it doesn't need to
// round-trip through Rust or be part of the "clear all app data" reset.
export function useRouletteCustomization() {
  const [theme, setTheme] = useState<WheelThemeKey>(() => readStored().theme);
  const [customColors, setCustomColors] = useState<string[]>(() => readStored().customColors);
  const [durationMs, setDurationMs] = useState(() => readStored().durationMs);
  const [showLabels, setShowLabels] = useState(() => readStored().showLabels);
  const [wheelSize, setWheelSize] = useState<WheelSizeKey>(() => readStored().wheelSize);
  const [soundEnabled, setSoundEnabled] = useState(() => readStored().soundEnabled);
  const [soundVolume, setSoundVolume] = useState(() => readStored().soundVolume);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme, customColors, durationMs, showLabels, wheelSize, soundEnabled, soundVolume })
      );
    } catch {
      // ignore — this is a convenience preference, not critical state
    }
  }, [theme, customColors, durationMs, showLabels, wheelSize, soundEnabled, soundVolume]);

  return {
    theme,
    setTheme,
    customColors,
    setCustomColors,
    durationMs,
    setDurationMs,
    showLabels,
    setShowLabels,
    wheelSize,
    setWheelSize,
    soundEnabled,
    setSoundEnabled,
    soundVolume,
    setSoundVolume,
  };
}
