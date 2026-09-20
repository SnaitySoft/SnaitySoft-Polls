import { usePollStore } from "@/store/usePollStore";
import { nextOverlaySeq } from "@/lib/overlaySeq";
import { RouletteEntry } from "./engine";

export interface RouletteSpinOptions {
  durationMs: number;
  colors: readonly string[];
  showLabels: boolean;
  scale: number;
  // The "N participantes" pill only makes sense for the chat-keyword draw (real viewers
  // "participating") — the plain list draw's entries are just items, so it stays off there.
  showParticipantCount: boolean;
  soundEnabled: boolean;
  // 0-100, matches the "Personalizar roleta" slider — converted to the 0-1 range Audio.volume
  // expects on the overlay side (see overlay.rs's playSpinSound/playWinSound).
  soundVolume: number;
}

function sendRouletteSpin(
  title: string,
  entries: RouletteEntry[],
  winnerId: string | null,
  spinId: number,
  options: RouletteSpinOptions
) {
  const send = usePollStore.getState().onOverlayUpdate;
  send?.(
    JSON.stringify({
      type: "roulette_spin",
      data: {
        title,
        entries: entries.map((e) => ({ id: e.id, label: e.label, weight: e.weight })),
        winnerId,
        spinId,
        durationMs: options.durationMs,
        colors: options.colors,
        showLabels: options.showLabels,
        scale: options.scale,
        showParticipantCount: options.showParticipantCount,
        soundEnabled: options.soundEnabled,
        soundVolume: options.soundVolume,
      },
      seq: nextOverlaySeq(),
    })
  );
}

// Mirrors the dashboard's poll_update/poll_cleared broadcast pattern (see usePollStore's
// startPoll/clearCurrentPoll) but bypasses the store since roulette state is UI-local — this
// just reuses the same onOverlayUpdate → Tauri `update_overlay` → WS channel the poll already
// broadcasts on, so the OBS overlay (src-tauri/src/overlay.rs) can render the spin live. The
// colors/duration/showLabels are sent every time (not just configured once) so the overlay
// always renders with the exact same "Personalizar roleta" choices as the dashboard.
export function broadcastRouletteSpin(
  title: string,
  entries: RouletteEntry[],
  winnerId: string,
  spinId: number,
  options: RouletteSpinOptions
) {
  sendRouletteSpin(title, entries, winnerId, spinId, options);
}

// Static "here's who/what's in the running" view of the wheel — spinId 0 and no winnerId means
// neither renderer (RouletteWheel.tsx nor overlay.rs) ever treats it as a spin to animate, so
// this just keeps the overlay's colors/entries/labels in sync with what's being set up, live,
// while the streamer is still typing a keyword or pasting a list — before the first real spin.
export function broadcastRoulettePreview(title: string, entries: RouletteEntry[], options: RouletteSpinOptions) {
  sendRouletteSpin(title, entries, null, 0, options);
}

export function broadcastRouletteClear() {
  const send = usePollStore.getState().onOverlayUpdate;
  send?.(JSON.stringify({ type: "roulette_cleared", data: null, seq: nextOverlaySeq() }));
}
