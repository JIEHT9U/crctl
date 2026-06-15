import { join } from "node:path";
import { homedir } from "node:os";

/** Prefix for all tmux sessions managed by crctl. */
export const SESSION_PREFIX = "claude-rc";

/** Per-user config directory (platform-dependent). */
export const CONFIG_DIR =
  process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "crctl")
    : join(homedir(), ".config", "crctl");

/** Session registry file. */
export const SESSIONS_FILE = join(CONFIG_DIR, "sessions.json");

/**
 * Claude Code's global config (`~/.claude.json`). crctl reads/writes the
 * per-project `hasTrustDialogAccepted` flag here so a detached `claude
 * remote-control` doesn't block on the workspace-trust dialog.
 */
export const CLAUDE_CONFIG_FILE = join(homedir(), ".claude.json");

/** GitHub repository (owner/name) used by `crctl update`. */
export const REPO = "JIEHT9U/crctl";

/** systemd user unit file (Linux) — restores sessions after login. */
export const SYSTEMD_UNIT_NAME = "crctl.service";
export const SYSTEMD_UNIT_PATH = join(
  homedir(),
  ".config",
  "systemd",
  "user",
  SYSTEMD_UNIT_NAME
);

/** launchd LaunchAgent (macOS) — restores sessions after login. */
export const LAUNCHD_LABEL = "com.crctl.restore";
export const LAUNCHD_PLIST_PATH = join(
  homedir(),
  "Library",
  "LaunchAgents",
  `${LAUNCHD_LABEL}.plist`
);

/** How many times to poll the pane for the browser link. */
export const LINK_WAIT_ATTEMPTS = 30;

/** Delay between polls, in milliseconds (30 × 500ms = 15s total). */
export const LINK_WAIT_INTERVAL_MS = 500;
