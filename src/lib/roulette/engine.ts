import { ChatMessage } from "@/lib/poll/types";

// Starts from the design system's validated 8-color palette (references/palette.md in the
// dataviz skill) plus 4 more curated hues per theme — 12 total, cycled when there are more
// entries than slots since wheel segments are decorative, not identity-bearing like a chart
// series. The extra 4 aren't independently CVD-validated the way the base 8 are, but the goal
// here is fewer repeats around a busy wheel, not statistical-chart-grade color safety.
export const WHEEL_THEMES = {
  padrao: [
    "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767",
    "#17a2b8", "#eab308", "#a16207", "#64748b",
  ],
  marca: [
    "#6366f1", "#818cf8", "#a855f7", "#c084fc", "#ec4899", "#f472b6", "#8b5cf6", "#d946ef",
    "#7c3aed", "#db2777", "#a78bfa", "#e879f9",
  ],
  pastel: [
    "#93c5fd", "#fdba74", "#86efac", "#fde68a", "#f9a8d4", "#a7f3d0", "#c4b5fd", "#fca5a5",
    "#fbcfe8", "#bae6fd", "#d9f99d", "#ddd6fe",
  ],
} as const;
export type WheelThemeKey = keyof typeof WHEEL_THEMES | "custom";
export const DEFAULT_WHEEL_THEME: WheelThemeKey = "padrao";

// Starting point for the "Personalizado" theme, before the user edits any swatch.
export const CUSTOM_THEME_DEFAULT_COLORS: string[] = [...WHEEL_THEMES.padrao];

export const WHEEL_SIZE_OPTIONS = [
  { key: "padrao", scale: 1 },
  { key: "grande", scale: 1.25 },
  { key: "enorme", scale: 1.5 },
] as const;
export type WheelSizeKey = (typeof WHEEL_SIZE_OPTIONS)[number]["key"];
export const DEFAULT_WHEEL_SIZE: WheelSizeKey = "padrao";

export function wheelScaleFor(size: WheelSizeKey): number {
  return WHEEL_SIZE_OPTIONS.find((o) => o.key === size)?.scale ?? 1;
}

export const SPIN_DURATION_OPTIONS = [
  { key: "rapido", ms: 3000 },
  { key: "padrao", ms: 5000 },
  { key: "longo", ms: 8000 },
] as const;
// Shared with the OBS overlay's own spin animation (src-tauri/src/overlay.rs) so the two stay
// in sync — the exact duration is also carried in each broadcast payload, this is just the
// starting default before the user picks something else in "Personalizar roleta".
export const DEFAULT_SPIN_DURATION_MS = 5000;

export const DEFAULT_SOUND_ENABLED = true;
// 0-100, mirrors how the overlay's Audio elements set their own `volume` (see overlay.rs's
// playSpinSound/playWinSound) — kept as a percentage here since that's what the slider shows.
export const DEFAULT_SOUND_VOLUME = 70;

// Cycles through the chosen theme once entries outnumber its colors — a flat, solid-color
// repeat (rather than generating a unique hue per segment) is what most wheel-of-names tools
// do, and it keeps every segment matching one of the colors the user actually picked.
export function colorForSegment(index: number, colors: readonly string[]): string {
  return colors[index % colors.length];
}

export interface RouletteEntry {
  id: string; // normalized key — lowercased username (chat mode) or lowercased item text (list mode)
  label: string;
  weight: number;
  platforms: ChatMessage["platform"][];
}

// Groups chat messages containing the keyword by username, aggregating weight across every
// platform that username appears on — that aggregation is what lets a viewer chatting from
// Twitch and YouTube at once carry proportionally more chances than someone on a single platform.
export function buildEntriesFromChat(chatLog: ChatMessage[], keyword: string): RouletteEntry[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return [];

  const byUser = new Map<string, RouletteEntry>();

  for (const msg of chatLog) {
    if (!msg.text.toLowerCase().includes(needle)) continue;
    const key = msg.username.trim().toLowerCase();
    if (!key) continue;

    const existing = byUser.get(key);
    if (existing) {
      existing.weight += 1;
      if (!existing.platforms.includes(msg.platform)) existing.platforms.push(msg.platform);
    } else {
      byUser.set(key, { id: key, label: msg.username.trim(), weight: 1, platforms: [msg.platform] });
    }
  }

  return Array.from(byUser.values()).sort((a, b) => b.weight - a.weight);
}

// Manual list mode — every item gets equal weight, blank lines are dropped, and duplicate
// items (case-insensitive) collapse into one entry so they don't silently double an item's odds.
export function buildEntriesFromList(items: string[]): RouletteEntry[] {
  const seen = new Set<string>();
  const entries: RouletteEntry[] = [];

  for (const raw of items) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ id: key, label, weight: 1, platforms: [] });
  }

  return entries;
}

export function pickWeightedWinner(entries: RouletteEntry[], rng: () => number = Math.random): RouletteEntry {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}
