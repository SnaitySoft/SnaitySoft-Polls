# SnaitySoft Polls

Desktop app (Windows/macOS/Linux) for running chat-voted polls across Twitch, YouTube, and
Kick — built with [Tauri v2](https://tauri.app) + [Next.js](https://nextjs.org). Viewers vote
by typing in chat, results render live in an [OBS](https://obsproject.com) browser-source
overlay.

## Features

- **Multi-platform chat voting** — Twitch, YouTube, and Kick simultaneously. Viewers vote by
  number (`1`, `2`, ...), letter (`a`, `b`, ...), or the option's own text.
- **OBS overlay** — a browser-source URL (`http://localhost:9898`) that shows the live poll and
  updates in real time over WebSocket, no manual refreshing.
- **Unique votes** — optional per-poll toggle to count at most one vote per viewer per platform.
- **Templates & history** — save a poll to relaunch later, and every ended poll is kept with its
  final result.
- **Auto-clear** — automatically hide the poll preview/overlay a configurable delay after it ends.
- **Chat announcements** — optionally posts when a poll starts and ends (Twitch and Kick; see
  [Platform integrations](#platform-integrations) for why YouTube doesn't post).

## Tech stack

- **Backend**: Rust, [Tauri v2](https://tauri.app), [Axum](https://github.com/tokio-rs/axum)
  (serves the overlay page, the poll WebSocket, and OAuth redirect callbacks, all on one local
  port).
- **Frontend**: Next.js 15 (static export), React, Zustand, Tailwind CSS.

## Getting started (development)

**Prerequisites**: [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io), a
[Rust toolchain](https://rustup.rs), and Tauri's
[platform-specific dependencies](https://v2.tauri.app/start/prerequisites/) (on Windows this is
mainly the WebView2 runtime, usually already present).

```bash
pnpm install
```

### App credentials (`.env`)

The app needs OAuth client credentials to let a bot account connect to Twitch and Kick chat.
These are the *app's* credentials (shared by every install), not something end users provide.

```bash
cp src-tauri/.env.example src-tauri/.env
```

Fill in:

| Variable | Where to get it |
|---|---|
| `TWITCH_CLIENT_ID` | [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) — client type **Public** (no secret). Uses the Device Code Grant Flow, no redirect URL to register. |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` | [kick.com/settings/developer](https://kick.com/settings/developer) — redirect URI `http://localhost:9898/oauth/kick/callback`. |

YouTube needs no credentials — see [Platform integrations](#platform-integrations) below.

`.env` is git-ignored and never committed. In dev mode it's read directly; nothing needs
encrypting until you build a release (see below).

### Run it

```bash
pnpm tauri dev
```

## Building a release

The bundled `.env` resource is AES-256-GCM encrypted rather than shipped as plain text — see
[Secrets & the encrypted `.env`](#secrets--the-encrypted-env) for why. This adds one step before
packaging:

```bash
cd src-tauri
cargo run --example encrypt_env   # (re)generates .env.enc from your local .env
cd ..
pnpm tauri build
```

The installer lands in `src-tauri/target/release/bundle/`. Re-run `encrypt_env` any time you
change `.env` — a stale `.env.enc` silently ships old credentials.

## Platform integrations

Each platform's official chat API has a real limitation for a local desktop app, so each one
uses a different approach:

- **Twitch** — official IRC-over-WebSocket chat, official OAuth (Device Code Grant Flow, no
  client secret — Twitch's "Public" app type doesn't support one).
- **Kick** — the official API only *delivers* incoming chat via webhooks, which need a public
  HTTPS URL and aren't viable for a local app. Reading uses the same public Pusher WebSocket
  kick.com's own site connects to — unofficial, undocumented, and could change without notice.
  Posting uses the official, documented `POST /public/v1/chat` API with OAuth (PKCE **and** a
  client secret together — the one platform of the three that requires both).
- **YouTube** — the official Data API v3 charges quota per chat-read call and exhausts the free
  10,000/day tier within hours of continuous polling. Reading instead uses YouTube's internal
  "innertube" endpoint (the same one youtube.com's own web player calls) — no API key, no OAuth,
  no quota, but unofficial and could break without notice. This is why **YouTube is read-only**:
  there's no bot account, so it can't post the start/end chat announcement the other two can.
  You connect it by pasting the live's URL (works for unlisted/private streams too) rather than
  logging in.

## Secrets & the encrypted `.env`

The bundled `.env` (Twitch/Kick client IDs, Kick's client secret) is encrypted at rest
(`src-tauri/src/env_crypto.rs`, AES-256-GCM) instead of shipped as a plain-text resource file,
so it's not readable by just unzipping the installer. Two honest limits worth knowing if you're
contributing or forking this:

- **This does not stop real reverse engineering.** The app has to decrypt the secret at runtime
  to make OAuth calls, so the key ships in the binary too. It only raises the bar against casual
  inspection (opening the installer in an archive tool), not against someone who loads the
  binary into a disassembler.
- **The encryption key is never committed.** `build.rs` generates a random key once per checkout
  into `.enc_key` (git-ignored) and bakes it in at compile time — a key hardcoded in source would
  be public the moment this repo is, defeating the point entirely. Every contributor's build uses
  a different key; only `.env.enc` files *you* generate locally are meaningful to *your* build.

The real fix for a truly secret `client_secret` is a server-side token-exchange proxy (the app
calls your backend, your backend holds the secret) — out of scope for now, but worth knowing this
is a mitigation, not a guarantee.

## License

MIT — see [LICENSE](LICENSE).
