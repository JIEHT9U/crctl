import { execSync, spawnSync } from "node:child_process";
import { REPO } from "../constants";

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
