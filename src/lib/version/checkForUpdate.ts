import { getVersion } from "@tauri-apps/api/app";
import { useToastStore } from "@/store/useToastStore";
import { translate } from "@/lib/i18n/useTranslation";

export const REPO = "SnaitySoft/SnaitySoft-Polls";
export const REPO_URL = `https://github.com/${REPO}`;

interface GithubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
}

type Semver = [number, number, number];

function parseVersion(v: string): Semver | null {
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNewer(remote: Semver, local: Semver): boolean {
  for (let i = 0; i < 3; i++) {
    if (remote[i] > local[i]) return true;
    if (remote[i] < local[i]) return false;
  }
  return false;
}

// The release workflow (.github/workflows/release.yml) only ever publishes prereleases —
// GitHub's /releases/latest endpoint explicitly excludes those, so it would report nothing
// (or a stale non-prerelease) for this repo. Listing releases directly and taking the first
// (GitHub returns them newest-first) is the correct way to find the actual latest one here.
let checked = false;

export async function checkForUpdate(): Promise<void> {
  // React StrictMode (Next.js dev) double-invokes the mount effect that calls this, so
  // without this guard the check — and any resulting toast — ran twice per session.
  if (checked) return;
  checked = true;

  try {
    const currentVersion = parseVersion(await getVersion());
    if (!currentVersion) return;

    const res = await fetch(`https://api.github.com/repos/${REPO}/releases`);
    if (!res.ok) return;
    const releases: GithubRelease[] = await res.json();
    const latest = releases.find((r) => !r.draft);
    if (!latest) return;

    const latestVersion = parseVersion(latest.tag_name);
    if (!latestVersion || !isNewer(latestVersion, currentVersion)) return;

    useToastStore.getState().pushToast(
      translate("update.available", { version: latest.tag_name }),
      "info",
      { persistent: true, action: { label: translate("update.viewOnGithub"), url: latest.html_url } }
    );
  } catch {
    // best-effort — offline, GitHub down, rate-limited, etc. shouldn't bother the user
  }
}
