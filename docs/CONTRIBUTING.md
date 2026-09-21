# Contributing

Thanks for considering a contribution to SnaitySoft Polls. This project is developed casually
in the open — there's no formal process, but a few conventions keep things consistent.

For how to set up your environment, run the app, and build a release, see
[DEVELOPMENT.md](DEVELOPMENT.md) first.

## Before you start

For anything beyond a small fix (a new feature, a behavior change, a refactor), open an issue
or start a discussion first. It saves you from spending time on something that might not fit the
project's direction, and lets us agree on an approach before code is written.

For typos, small bug fixes, or docs improvements, feel free to open a PR directly.

## Workflow

1. Fork the repo and create a branch off `main` (e.g. `fix/kick-reconnect`, `feat/poll-export`).
2. Make your changes, following the existing code style (see below).
3. Run the linter before pushing:
   ```bash
   pnpm lint
   ```
4. Commit with a clear, imperative-mood subject line (`Fix Kick reconnect loop`, not
   `fixed a bug` or `fixes`). Add a body paragraph if the *why* isn't obvious from the diff or
   the subject alone — see the existing history (`git log`) for examples.
5. Open a pull request against `main` describing what changed and why. Screenshots or a short
   clip are appreciated for UI changes.

## Code style

- TypeScript/React: follow the patterns already in `src/components/` and `src/lib/` — small,
  focused components; framework-agnostic logic kept out of components where practical.
- i18n: every user-facing string goes through `src/lib/i18n/` (`pt.ts` is canonical; `en.ts` is
  typed against its keys, so a missing translation fails to compile rather than falling back
  silently at runtime). Adding a string means adding it to both files.
- Rust: standard `rustfmt` conventions; run `cargo fmt` in `src-tauri/` before committing
  Rust changes.
- No unrelated reformatting in a functional PR — keep diffs focused on the change being made.

## Reporting bugs

Open a GitHub issue with:
- What you expected vs. what happened.
- Steps to reproduce, if known.
- Your OS and app version (shown in the sidebar, or in **Settings**).
- Relevant log output — **Settings → Abrir pasta de logs / Open logs folder** keeps the last 5
  sessions and is the fastest way to spot what went wrong.

## Security issues

Please don't open a public issue for a security concern (e.g. a way to bypass the `.env`
encryption meaningfully, not just the documented limits already called out in the README).
Open a private security advisory on GitHub instead, or contact a maintainer directly.
