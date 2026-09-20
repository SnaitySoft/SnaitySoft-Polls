// Every overlay broadcast (poll or roulette) goes out as its own fire-and-forget Tauri `invoke`
// call — nothing awaits the previous one before starting the next. When several fire in quick
// succession (e.g. a component's unmount cleanup broadcasting "cleared" right as the next
// component's mount effect broadcasts a fresh preview), their async IPC round-trips can land on
// the Rust side out of order, leaving a stale message as the cached "last state" a newly
// connecting OBS browser source gets replayed. Stamping every payload with a monotonically
// increasing sequence number (see OverlayState::broadcast in src-tauri/src/overlay.rs, which
// drops any message whose seq isn't greater than the last one it accepted) makes the outcome
// depend on send order regardless of arrival order.
let seq = 0;

export function nextOverlaySeq(): number {
  seq += 1;
  return seq;
}
