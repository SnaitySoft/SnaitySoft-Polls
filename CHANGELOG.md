# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

The `## [x.y.z]` heading text below this line is what `.github/workflows/release.yml`
extracts as the GitHub release body when you push a matching `vx.y.z` tag — keep it
updated before tagging a release, or the workflow falls back to a generic message.

## [0.3.0] - 2026-10-04

### ✨ Highlights

- **Votes now show which platform they came from.** The poll overlay and the in-app
  preview/history render a stacked, color-coded bar per option — Twitch, YouTube, and Kick
  each get their own segment and color, with a legend.
- **Poll history got a lot more detailed.** Each entry now shows the winner, total votes per
  platform, and an expandable audit log listing every individual vote (voter, platform,
  chosen option, timestamp).

### Fixed

- A chat client (notably Twitch's own web UI) silently appends an invisible character when
  you resend an identical message, to dodge the platform's duplicate-message filter — this
  could make a resent vote fail to match its option. Votes are now normalized to strip these
  before matching.
- The Kick connector was re-processing its own poll start/end chat announcements as incoming
  messages when they echoed back over the Pusher socket.

## [0.2.0] - 2026-08-25

### ✨ Highlights

- **YouTube chat reading no longer needs a Google account.** No OAuth, no login, and no
  more hitting Google's 10,000-unit/day quota mid-stream. Just paste your live's URL in
  Connections — supports `watch?v=`, `youtu.be/`, `/live/`, and `/@handle/live` links.
  Trade-off: YouTube is read-only now (it can't post the start/end chat announcement the
  way Twitch and Kick still do).
- **The app now speaks English**, alongside the existing Portuguese. It auto-detects your
  OS language on first run and falls back to English for anything that isn't Portuguese;
  switch anytime in Settings.
- **In-app update notifications** — on launch, the app checks GitHub for a newer release
  and shows a persistent toast with a link if one's available.

### Added

- Persistent log files for troubleshooting, with a one-click "Open logs folder" button in
  Settings. Keeps the last 5 sessions.
- A global toast notification system — connection drops, save failures, and other
  background errors now surface visibly instead of failing silently.
- "Open repository on GitHub" button and the current app version, both visible in the UI.
- A length limit on poll options, matching the existing question length limit.

### Fixed

- Kick chat reading was broken (wrong Pusher channel name, wrong event name, wrong message
  field) — fixed by sniffing Kick's own live traffic instead of relying on third-party docs.
- Kick chat announcements (poll start/end) were failing with an HTTP 500.
- Several YouTube live-URL formats failed to resolve, including unlisted/private streams
  and channel `/live` redirects.
- Long, unbroken poll option text (e.g. no spaces) could overflow the whole window instead
  of wrapping.
- Chat announcement messages could exceed Twitch/Kick's 500-character limit with many long
  options — now truncated safely with a "+N more" indicator.
- Settings could get stuck showing "Saving…" forever under certain conditions.
- The update-available toast could appear twice.

### Security

- The bundled OAuth app credentials (`.env`) are now encrypted at rest (AES-256-GCM)
  instead of shipped as plain text, with the encryption key generated locally per build and
  never committed to source — relevant now that the project is open source.

### Internal

- GitHub Actions release workflow: pushing a `v*` tag now builds Windows, macOS
  (universal), and Linux bundles and publishes them as a pre-release automatically.
- Backend (Rust) error messages are now localized too, not just the UI.

## [0.1.0] - 2026-08-23

Initial release.
