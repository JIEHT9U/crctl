import {
  existsSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR } from "../constants";
import { serviceInstalled, uninstallService } from "../service";
import { detectShell } from "../utils";

export function cmdUninstall(): void {
  const binaryPath = process.argv[1];
  const shellName = detectShell(process.env.SHELL || "");

  console.log("🗑️  Uninstalling crctl...");

  // 0. Remove the autostart service so it doesn't dangle after the binary goes.
  if (serviceInstalled()) {
    try {
      uninstallService();
      console.log("✅ Autostart service removed");
    } catch {
      console.log("⚠️  Could not remove autostart service");
    }
  }

  // 1. Remove binary
  try {
    unlinkSync(binaryPath);
    console.log(`✅ Binary removed: ${binaryPath}`);
  } catch {
    console.log(`⚠️  Could not remove binary: ${binaryPath}`);
  }

  // 2. Remove crctl lines from the shell config
  const configs: Record<string, string> = {
    fish: join(homedir(), ".config", "fish", "config.fish"),
    bash: join(homedir(), ".bashrc"),
    zsh: join(homedir(), ".zshrc"),
  };

  const configPath = configs[shellName];
  if (configPath && existsSync(configPath)) {
    try {
      const originalLines = readFileSync(configPath, "utf8").split("\n");
      const cleanedLines = originalLines.filter(
        (line) => !line.includes("crctl")
      );

      if (cleanedLines.length < originalLines.length) {
        writeFileSync(configPath, cleanedLines.join("\n"));
        console.log(`✅ Cleaned crctl entries from ${configPath}`);
      }
    } catch {
      console.log(`⚠️  Could not clean ${configPath}`);
    }
  }

  // 3. Remove completions
  const completionPaths = [
    join(homedir(), ".config", "fish", "completions", "crctl.fish"),
    join(homedir(), ".bash_completion_crctl"),
    join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl", "_crctl"),
  ];

  for (const path of completionPaths) {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
        console.log(`✅ Removed completion: ${path}`);
      } catch {}
    }
  }

  // 4. Remove config directory (session registry)
  if (existsSync(CONFIG_DIR)) {
    try {
      rmSync(CONFIG_DIR, { recursive: true, force: true });
      console.log(`✅ Removed config: ${CONFIG_DIR}`);
    } catch {
      console.log(`⚠️  Could not remove config: ${CONFIG_DIR}`);
    }
  }

  console.log("");
  console.log(
    "👋 crctl has been removed. You may need to restart your terminal."
  );
}
