"use client";

import { useEffect, useMemo, useRef } from "react";
import { RouletteEntry, colorForSegment, DEFAULT_SPIN_DURATION_MS } from "@/lib/roulette/engine";

// Base pixel sizes at scale 1 — multiplied by the "Tamanho da roda" scale factor so the wheel,
// hub and pointer grow together instead of the pointer looking tiny on a blown-up wheel or
// overflowing a shrunken one.
const BASE_WHEEL_PX = 224;
const BASE_HUB_PX = 44;
const BASE_POINTER_SIDE_PX = 9;
const BASE_POINTER_TOP_PX = 15;
const BASE_POINTER_OFFSET_PX = 4; // how far the pointer tip overlaps the wheel's top edge
const WHEEL_BORDER_PX = 4;
const LABEL_GAP_FROM_HUB_PX = 4;
const LABEL_SAFETY_MARGIN_PX = 6; // clearance from the wheel's inner edge, kept fixed (not scaled)
const BASE_LABEL_FONT_PX = 11;
const MIN_LABEL_MAX_WIDTH_PX = 40;
const MIN_LABEL_FONT_PX = 5; // labels always show (however many entries) — this is the readability floor

interface RouletteWheelProps {
  entries: RouletteEntry[];
  spinId: number; // bump to trigger a new spin
  winnerId: string | null; // entry the wheel must land on for the current spinId
  onSpinEnd?: () => void;
  emptyLabel: string;
  colors: readonly string[];
  durationMs: number;
  showLabels: boolean;
  scale?: number;
}

export function RouletteWheel({
  entries,
  spinId,
  winnerId,
  onSpinEnd,
  emptyLabel,
  colors,
  durationMs,
  showLabels,
  scale = 1,
}: RouletteWheelProps) {
  const discRef = useRef<HTMLDivElement>(null);
  const wheelPx = Math.round(BASE_WHEEL_PX * scale);
  const hubPx = Math.round(BASE_HUB_PX * scale);
  // Sized from actual available radius (not a flat scale multiply) so a bigger wheel fits
  // meaningfully longer names instead of just rendering the same character count bigger — the
  // margin/gap stay fixed while the wheel grows, so nearly all the extra radius becomes usable
  // text width. Font grows slower than linear (sqrt) so it doesn't dominate that extra width.
  const labelPad = Math.round(hubPx / 2 + LABEL_GAP_FROM_HUB_PX);
  const labelMaxWidth = Math.max(
    MIN_LABEL_MAX_WIDTH_PX,
    Math.round(wheelPx / 2 - WHEEL_BORDER_PX - labelPad - LABEL_SAFETY_MARGIN_PX)
  );
  // Labels always show, no matter how many entries — so past a handful, font size also has to
  // shrink with entry count, not just wheel scale: at N entries a slice is only 360/N degrees
  // wide, i.e. roughly (2*pi*radius/N)px of arc at the label's radius, and text taller than
  // that visibly bleeds into the neighboring slice's color. The 0.62 factor leaves clearance for
  // line-height/anti-aliasing rather than sizing text to the exact geometric limit.
  const midRadius = labelPad + labelMaxWidth / 2;
  const arcBoundFont = entries.length > 0 ? (2 * Math.PI * midRadius * 0.62) / entries.length : Infinity;
  const labelFont = Math.max(
    MIN_LABEL_FONT_PX,
    Math.min(Math.round(BASE_LABEL_FONT_PX * Math.sqrt(scale)), Math.round(arcBoundFont))
  );

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0) || 1;

  const segments = useMemo(() => {
    let acc = 0;
    const result: { entry: RouletteEntry; start: number; end: number; color: string }[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const start = (acc / totalWeight) * 360;
      const end = ((acc + entry.weight) / totalWeight) * 360;
      acc += entry.weight;
      result.push({ entry, start, end, color: colorForSegment(i, colors) });
    }
    return result;
  }, [entries, totalWeight, colors]);

  useEffect(() => {
    if (spinId === 0) return;
    const target = winnerId ? segments.find((s) => s.entry.id === winnerId) : undefined;
    const el = discRef.current;
    if (!target || !el) return;

    // The pointer is fixed at 12 o'clock (0deg). conic-gradient segments are laid out clockwise
    // from 0deg, so landing a segment's midpoint under the pointer means rotating by (360 - mid)
    // degrees — plus a few full turns so the spin actually reads as one.
    const midAngle = (target.start + target.end) / 2;
    // Derived from spinId (not Math.random) so this stays deterministic — varies by a few turns
    // across consecutive spins, which is all the visual variety needs. Scaled by durationMs
    // (relative to the 5s default, which gets 5/6/7 turns) so picking "Longo" actually spins
    // more, not just the same rotation stretched into slow motion — angular speed stays roughly
    // constant across "Rápido"/"Padrão"/"Longo" instead of the turn count staying fixed.
    const extraSpins = Math.round((5 + (spinId % 3)) * (durationMs / DEFAULT_SPIN_DURATION_MS));
    const delta = (((360 - midAngle) % 360) + 360) % 360;
    const finalRotation = delta + extraSpins * 360;

    // Snap back to a fixed 0deg baseline before animating, rather than continuing from wherever
    // the wheel last stopped. The overlay (src-tauri/src/overlay.rs) runs the identical sequence
    // from the identical baseline, so the two land on the same rotation distance every time —
    // accumulating from each instance's own history is what let them drift apart and desync.
    el.style.transition = "none";
    el.style.transform = "rotate(0deg)";
    void el.offsetHeight; // force a reflow so the reset above actually commits before animating away from it
    el.style.transition = `transform ${durationMs}ms cubic-bezier(0.15, 0.65, 0.15, 1)`;
    el.style.transform = `rotate(${finalRotation}deg)`;

    const timeout = setTimeout(() => onSpinEnd?.(), durationMs + 100);
    return () => clearTimeout(timeout);
    // winnerId/segments/onSpinEnd are read from the same render that set spinId, so they're
    // already current — deliberately omitted so this only fires on an actual new spin request.
  }, [spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradient = segments.length
    ? `conic-gradient(${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ")})`
    : "#27272a";

  const withLabels = showLabels && entries.length > 0;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative shrink-0" style={{ width: wheelPx, height: wheelPx }}>
        <div
          className="absolute left-1/2 z-10 w-0 h-0 border-l-transparent border-r-transparent border-t-indigo-400 drop-shadow"
          style={{
            top: -Math.round(BASE_POINTER_OFFSET_PX * scale),
            transform: "translateX(-50%)",
            borderLeftWidth: Math.round(BASE_POINTER_SIDE_PX * scale),
            borderRightWidth: Math.round(BASE_POINTER_SIDE_PX * scale),
            borderTopWidth: Math.round(BASE_POINTER_TOP_PX * scale),
            borderLeftStyle: "solid",
            borderRightStyle: "solid",
            borderTopStyle: "solid",
          }}
        />
        <div
          ref={discRef}
          className="relative rounded-full border-4 border-zinc-700 shadow-xl overflow-hidden"
          style={{ width: wheelPx, height: wheelPx, background: gradient }}
        >
          {withLabels &&
            segments.map((s) => {
              const midAngle = (s.start + s.end) / 2;
              const wrapperRotation = midAngle - 90;
              // The wrapper's rotation also rotates the text glyphs (nothing counter-rotates
              // them), so on the left half of the wheel — where that rotation falls outside
              // (-90deg, 90deg) — the label would render upside down. A second 180deg turn on
              // just the span un-flips the glyphs in place — but only because the hub-clearance
              // gap lives on the (unrotated-relative-to-itself) wrapper's padding, not on the
              // span: a span rotating 180deg around its own center stays put only when that
              // center IS the visual text's center, which padding-left on the span itself would
              // throw off (mirroring it back toward the hub, right behind the opaque hub disc).
              const normalized = ((wrapperRotation % 360) + 360) % 360;
              const needsFlip = normalized > 90 && normalized < 270;
              return (
                <div
                  key={s.entry.id}
                  className="absolute top-1/2 left-1/2 h-0 flex items-center pointer-events-none"
                  style={{
                    transformOrigin: "0 0",
                    transform: `rotate(${wrapperRotation}deg)`,
                    paddingLeft: labelPad,
                  }}
                >
                  <span
                    className="inline-block truncate text-white font-extrabold"
                    style={{
                      maxWidth: labelMaxWidth,
                      fontSize: labelFont,
                      textShadow: "0 1px 2px rgba(0,0,0,0.65), 0 0 3px rgba(0,0,0,0.45)",
                      transform: needsFlip ? "rotate(180deg)" : undefined,
                    }}
                  >
                    {s.entry.label}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-full bg-zinc-900 border-2 border-zinc-600"
            style={{ width: hubPx, height: hubPx }}
          />
        </div>
        {segments.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-8">
            <p className="text-zinc-500 text-xs">{emptyLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}
