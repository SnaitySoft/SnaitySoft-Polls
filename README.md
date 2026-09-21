<p align="right"><strong>English</strong> | <a href="README.pt-BR.md">Português (BR)</a></p>

<p align="center">
  <img src="src-tauri/icons/icon.png" width="96" height="96" alt="SnaitySoft Polls icon">
</p>

<h1 align="center">SnaitySoft Polls</h1>

<p align="center">
Desktop app (Windows/macOS/Linux) for running chat-voted polls across Twitch, YouTube, and
Kick — built with <a href="https://tauri.app">Tauri v2</a> + <a href="https://nextjs.org">Next.js</a>.
Viewers vote by typing in chat, results render live in an <a href="https://obsproject.com">OBS</a>
browser-source overlay.
</p>

<p align="center">
  <a href="https://github.com/SnaitySoft/SnaitySoft-Polls/releases/latest">
    <img src="https://img.shields.io/github/v/release/SnaitySoft/SnaitySoft-Polls?style=for-the-badge&logo=github&label=Download&color=6d28d9" alt="Download the latest release">
  </a>
</p>

## Installation

Download the latest installer for your OS from the
**[Releases page](https://github.com/SnaitySoft/SnaitySoft-Polls/releases)** — Windows, macOS,
and Linux builds are published automatically for every version.

## Screenshots

| Create & manage polls | Chat connections | Settings |
|---|---|---|
| ![Poll creation screen](docs/screenshots/nova-poll.png) | ![Chat connections screen](docs/screenshots/conexoes.png) | ![Settings screen](docs/screenshots/configuracoes.png) |

## Usage

1. **Connect a chat account** — open **Connections** and connect a bot account for Twitch
   and/or Kick (OAuth login), or paste your live's URL for YouTube (no login needed).
2. **Create a poll** — on **New Poll**, type a question, add 2–10 options, pick a duration (or
   a custom one), and optionally toggle unique votes per viewer.
3. **Add the overlay to OBS** — copy the overlay URL from the sidebar (`http://localhost:9898`)
   and add it as a Browser Source in OBS; it updates live over WebSocket, no refreshing needed.
4. **Start the poll** — viewers vote in chat by number, letter, or the option's own text; the
   live tally shows both in the app's preview and in the OBS overlay.
5. **Let it end** — automatically when the timer runs out, or end it early from the app. Save
   questions you reuse often as templates in **My Polls**, and every past result is kept in
   **History**.

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
- **Portuguese and English** — auto-detects your OS language on first run, switchable anytime in
  Settings.

## Tech stack

Rust + [Tauri v2](https://tauri.app) + [Axum](https://github.com/tokio-rs/axum) on the backend,
Next.js (static export) + React + Zustand + Tailwind CSS on the frontend. See
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full breakdown.

## Development

Want to run it from source or contribute a change? Setup, OAuth credentials, building a release,
and the CI process are all in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**; contribution
workflow and code style are in **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)**.

## Platform integrations

Twitch and Kick connect via a bot account and can post chat announcements. YouTube is
**read-only** — no login, just paste your live's URL — so it can't post the start/end
announcement the other two can. Each platform needed a different, sometimes unofficial,
approach behind the scenes; the full rationale and trade-offs are in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#platform-integrations).

## License

MIT — see [LICENSE](LICENSE).
