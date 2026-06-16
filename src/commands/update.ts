import { execSync, spawnSync } from "node:child_process";
import { REPO } from "../constants";

/** True when `latest` is strictly newer than `current` (numeric semver-ish). */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Non-blocking, never-throwing update probe for `doctor`/`start`. Returns the
 * newer version string when an update is available, else null (offline,
 * rate-limited, dev build, or already current — all silently treated as "no
 * update" so they never nag or break the calling command).
 */
export function checkUpdateAvailable(currentVersion: string): string | null {
  if (!currentVersion || currentVersion === "dev") return null;
  try {
    const output = execSync(
      `curl -s --max-time 3 https://api.github.com/repos/${REPO}/releases/latest`,
      { encoding: "utf8" }
    );
    const latest = JSON.parse(output);
    if (latest && typeof latest.tag_name === "string") {
      const latestVersion = latest.tag_name.replace(/^v/, "");
      if (isNewerVersion(latestVersion, currentVersion)) return latestVersion;
    }
  } catch {
    // offline / rate-limited / curl missing — fail open, no nag.
  }
  return null;
}

export function cmdUpdate(currentVersion: string): void {
  console.log("🔄 Checking for updates...");
  try {
    const output = execSync(
      `curl -s https://api.github.com/repos/${REPO}/releases/latest`,
      { encoding: "utf8" }
    );
    const latest = JSON.parse(output);

    if (!latest || typeof latest.tag_name !== "string") {
      console.log("❌ Could not determine the latest version.");
      console.log("   (GitHub API rate limit or no releases yet?)");
      process.exit(1);
    }

    const latestVersion = latest.tag_name.replace(/^v/, "");

    if (latestVersion === currentVersion) {
      console.log(`✅ crctl is already up to date (${currentVersion}).`);
      return;
    }

    console.log(
      `🚀 New version available: ${latestVersion} (you have ${currentVersion})`
    );
    console.log("   Updating...");

    const result = spawnSync(
      "sh",
      [
        "-c",
        `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | sh`,
      ],
      { stdio: "inherit" }
    );

    if (result.status === 0) {
      console.log(`✅ Updated to ${latestVersion}!`);
    } else {
      console.log("❌ Update failed.");
      process.exit(1);
    }
  } catch (err: any) {
    console.log("❌ Failed to check for updates.");
    console.log(`   Error: ${err.message}`);
    process.exit(1);
  }
}
