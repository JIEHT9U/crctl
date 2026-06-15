import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  LAUNCHD_LABEL,
  LAUNCHD_PLIST_PATH,
  SYSTEMD_UNIT_NAME,
  SYSTEMD_UNIT_PATH,
} from "./constants";
import { run } from "./tmux";

// ─── Autostart service ───────────────────────────────────────
//
// On login crctl re-spawns every session recorded in the registry via
// `crctl restore`. The integration with the OS init system lives here:
//   • Linux  → a systemd *user* unit  (~/.config/systemd/user/crctl.service)
//   • macOS  → a launchd LaunchAgent  (~/Library/LaunchAgents/<label>.plist)
//
// All `systemctl` / `launchctl` invocations are funnelled through this module,
// mirroring the "all tmux calls go through tmux.ts" rule. Pure text builders
// are exported separately so they can be unit-tested without touching disk.

export type ServiceKind = "systemd" | "launchd" | "unsupported";

/** Which init system this platform uses for the autostart service. */
export function serviceKind(): ServiceKind {
  if (process.platform === "linux") return "systemd";
  if (process.platform === "darwin") return "launchd";
  return "unsupported";
}

/** Absolute paths to the node runtime and the crctl entry script. */
export function execInfo(): { node: string; script: string } {
  return { node: process.execPath, script: resolve(process.argv[1]) };
}

/**
 * A deterministic PATH for the service environment. Login services inherit a
 * minimal PATH, so we bake in the dirs that hold node, crctl and tmux to make
 * `crctl restore` self-contained.
 */
export function servicePath(node: string, script: string): string {
  const dirs = [
    dirname(node),
    dirname(script),
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    join(homedir(), ".local", "bin"),
  ];
  // De-duplicate while preserving order.
  return [...new Set(dirs)].join(":");
}

/** systemd user unit text. */
export function systemdUnitText(node: string, script: string): string {
  const path = servicePath(node, script);
  return `[Unit]
Description=crctl — restore Claude Code remote-control sessions after login
Documentation=https://github.com/JIEHT9U/crctl
After=graphical-session.target

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=PATH=${path}
ExecStart=${node} ${script} restore

[Install]
WantedBy=default.target
`;
}

/** launchd LaunchAgent plist text. */
export function launchdPlistText(node: string, script: string): string {
  const path = servicePath(node, script);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${script}</string>
    <string>restore</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${path}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/crctl.restore.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/crctl.restore.log</string>
</dict>
</plist>
`;
}

/** Result of a service management action, with human-readable steps. */
export interface ServiceResult {
  ok: boolean;
  /** File the unit/plist was written to (or would live at). */
  path: string;
  /** Step-by-step log lines for the command to print. */
  steps: string[];
}

/** Install and enable the autostart service for the current platform. */
export function installService(): ServiceResult {
  const kind = serviceKind();
  const { node, script } = execInfo();
  const steps: string[] = [];

  if (kind === "systemd") {
    mkdirSync(dirname(SYSTEMD_UNIT_PATH), { recursive: true });
    writeFileSync(SYSTEMD_UNIT_PATH, systemdUnitText(node, script));
    steps.push(`Wrote unit: ${SYSTEMD_UNIT_PATH}`);

    const reload = run("systemctl", ["--user", "daemon-reload"]);
    const enable = run("systemctl", ["--user", "enable", SYSTEMD_UNIT_NAME]);
    const ok = reload.code === 0 && enable.code === 0;
    steps.push(ok ? "Enabled (starts on next login)" : "Failed to enable");
    if (!ok && enable.stderr) steps.push(enable.stderr);
    return { ok, path: SYSTEMD_UNIT_PATH, steps };
  }

  if (kind === "launchd") {
    mkdirSync(dirname(LAUNCHD_PLIST_PATH), { recursive: true });
    writeFileSync(LAUNCHD_PLIST_PATH, launchdPlistText(node, script));
    steps.push(`Wrote LaunchAgent: ${LAUNCHD_PLIST_PATH}`);

    // Reload to be idempotent: unload any stale copy, then load enabled.
    run("launchctl", ["unload", LAUNCHD_PLIST_PATH]);
    const load = run("launchctl", ["load", "-w", LAUNCHD_PLIST_PATH]);
    const ok = load.code === 0;
    steps.push(ok ? "Enabled (starts on next login)" : "Failed to enable");
    if (!ok && load.stderr) steps.push(load.stderr);
    return { ok, path: LAUNCHD_PLIST_PATH, steps };
  }

  return {
    ok: false,
    path: "",
    steps: [`Autostart is not supported on platform "${process.platform}".`],
  };
}

/** Disable and remove the autostart service. */
export function uninstallService(): ServiceResult {
  const kind = serviceKind();
  const steps: string[] = [];

  if (kind === "systemd") {
    if (existsSync(SYSTEMD_UNIT_PATH)) {
      run("systemctl", ["--user", "disable", SYSTEMD_UNIT_NAME]);
      unlinkSync(SYSTEMD_UNIT_PATH);
      run("systemctl", ["--user", "daemon-reload"]);
      steps.push(`Removed unit: ${SYSTEMD_UNIT_PATH}`);
    } else {
      steps.push("No service installed.");
    }
    return { ok: true, path: SYSTEMD_UNIT_PATH, steps };
  }

  if (kind === "launchd") {
    if (existsSync(LAUNCHD_PLIST_PATH)) {
      run("launchctl", ["unload", "-w", LAUNCHD_PLIST_PATH]);
      unlinkSync(LAUNCHD_PLIST_PATH);
      steps.push(`Removed LaunchAgent: ${LAUNCHD_PLIST_PATH}`);
    } else {
      steps.push("No service installed.");
    }
    return { ok: true, path: LAUNCHD_PLIST_PATH, steps };
  }

  return {
    ok: false,
    path: "",
    steps: [`Autostart is not supported on platform "${process.platform}".`],
  };
}

/** Whether the autostart service is currently installed. */
export function serviceInstalled(): boolean {
  const kind = serviceKind();
  if (kind === "systemd") return existsSync(SYSTEMD_UNIT_PATH);
  if (kind === "launchd") return existsSync(LAUNCHD_PLIST_PATH);
  return false;
}
