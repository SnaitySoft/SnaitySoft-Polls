import { info, warn, error } from "@tauri-apps/plugin-log";

// Most of the app's diagnostic output (chat connectors, vote processing, persistence
// failures) only ever went to console.* — invisible once the app is packaged, since a
// tester/streamer has no devtools open. This patches console.* once so everything also
// lands in the log file (see src-tauri/src/lib.rs's tauri_plugin_log setup), without having
// to rewrite every existing console.log/warn/error call site individually.
let attached = false;

// Next.js's dev-mode HMR client (`next dev`, used by `pnpm tauri dev`) logs its own
// "[Fast Refresh] rebuilding"/"done in ...ms" noise via plain console.log — not something
// this app ever produces itself, and it doesn't exist in the static-exported production
// build a real user runs, so it's pure dev-testing clutter, not a log we ever need on disk.
const NOISE_PATTERNS = [/^\[Fast Refresh\]/];

function isNoise(args: unknown[]): boolean {
  const first = args[0];
  return typeof first === "string" && NOISE_PATTERNS.some((p) => p.test(first));
}

function stringifyArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

export function attachConsoleLog() {
  if (attached) return;
  attached = true;

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  // mapped to info/warn/error (not trace/debug) since the Rust-side log level filter
  // defaults to Info — anything below that would be silently dropped before reaching disk.
  console.log = (...args: unknown[]) => {
    original.log(...args);
    if (!isNoise(args)) void info(stringifyArgs(args));
  };
  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    void warn(stringifyArgs(args));
  };
  console.error = (...args: unknown[]) => {
    original.error(...args);
    void error(stringifyArgs(args));
  };
}
